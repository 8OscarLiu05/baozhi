import base64
from contextlib import closing
import io
import json
from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from app import Server, Store
from knowledge_extract import QwenAdapter
from knowledge_store import KnowledgeError, KnowledgeStore

SOURCE = "https://fixture.invalid/example.pdf"

def pdf_bytes():
    from pypdf import PdfWriter
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
    writer = PdfWriter()
    page = writer.add_blank_page(width=500, height=700)
    font = DictionaryObject({NameObject("/Type"):NameObject("/Font"),
                             NameObject("/Subtype"):NameObject("/Type1"),
                             NameObject("/BaseFont"):NameObject("/Helvetica")})
    page[NameObject("/Resources")] = DictionaryObject({
        NameObject("/Font"):DictionaryObject({NameObject("/F1"):font})})
    stream = DecodedStreamObject()
    stream.set_data(b"BT /F1 12 Tf 72 650 Td (2.1 Waiting period 30 days.) Tj T* (2.2 Benefit amount is 20 USD.) Tj ET")
    page[NameObject("/Contents")] = writer._add_object(stream)
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()

def input_data(version, source=SOURCE, raw=None):
    return {"version_id":version, "kind":"terms", "filename":"synthetic.pdf",
            "source":source, "file":base64.b64encode(raw if raw is not None else pdf_bytes()).decode()}

def make_adapter(value="30 days", fact_type="waiting_period", evidence=None):
    def adapter(prompt):
        fragment = json.loads(prompt[1])[0]
        item = {"fact_type":fact_type,"fact_value":value,"unit":None,"conditions":[],
                "exceptions":[],"guarantee_type":"not_applicable","presence":"present",
                "evidence":[{"fragment_id":evidence or fragment["fragment_id"],
                             "quote":"2.1 Waiting period 30 days.","role":"supports"}]}
        return json.dumps({"candidates":[item]})
    adapter.method = "fixture"
    adapter.label = "synthetic-test-only"
    return adapter

def decision(status="pending", target="approved", **extra):
    return {"expected_status":status,"decision":target,"reason":"Synthetic test review",
            "confirmed":True,**extra}

class KnowledgeTests(unittest.TestCase):
    def setUp(self):
        temp = TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.path = Path(temp.name) / "test.sqlite"
        with closing(sqlite3.connect(self.path)) as c, c:
            c.executescript("CREATE TABLE documents(id TEXT,status TEXT); INSERT INTO documents VALUES('old','published');")
        self.kb = KnowledgeStore(self.path,migrate=True)
        self.v = self.new_version()
        self.m = self.kb.ingest(input_data(self.v),"builder")
        self.kb.verify_source(self.m,"Fixture metadata checked","reviewer")

    def new_version(self, filing="1", name="Synthetic", synthetic=True):
        return self.kb.version({"name":name,"insurer":"Fixture","filing":filing,
                                "edition":filing,"synthetic":synthetic},"builder")

    def candidate(self, adapter=None, material=None):
        return self.kb.start_extract(material or self.m,"builder",adapter or make_adapter())["candidate_ids"][0]

    def publish(self, *ids, previous=None):
        return self.kb.release(self.v,{"candidate_ids":list(ids),"expected_head":previous},"publisher")

    def test_migration_reentrant_legacy_untouched(self):
        KnowledgeStore(self.path,migrate=True)
        with self.kb.db() as c:
            self.assertEqual(tuple(c.execute("SELECT * FROM documents").fetchone()),("old","published"))
            self.assertEqual(c.execute("SELECT COUNT(*) FROM kg_migration").fetchone()[0],1)
            self.assertEqual(c.execute("PRAGMA foreign_key_check").fetchall(),[])
        self.assertIsNone(self.kb.lookup(self.v,"waiting_period","sales")["fact_id"])

    def test_failed_migration_rolls_back_ddl_and_retains_legacy(self):
        failed = self.path.with_name("failed.sqlite")
        with closing(sqlite3.connect(failed)) as c, c:
            c.executescript("CREATE TABLE documents(id TEXT); INSERT INTO documents VALUES('keep');")
        with patch("knowledge_store.Path.read_text",return_value="CREATE TABLE kg_migration(x); INVALID SQL;"):
            with self.assertRaises(sqlite3.OperationalError):
                KnowledgeStore(failed,migrate=True)
        with closing(sqlite3.connect(failed)) as c:
            self.assertEqual(c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall(),[("documents",)])
            self.assertEqual(c.execute("SELECT * FROM documents").fetchall(),[("keep",)])

    def test_pdf_integrity_source_and_dedupe(self):
        self.assertEqual(self.kb.ingest(input_data(self.v),"builder"), self.m)
        self.assertTrue(self.kb.fragments(self.m)[0]["page"] == 1)
        for data in (input_data(self.v,raw=b"not PDF"),input_data(self.v,"http://fixture.invalid/x"),
                     input_data(self.v,"https://user:secret@fixture.invalid/x")):
            with self.assertRaises(KnowledgeError):
                self.kb.ingest(data,"builder")
        real = self.new_version("r",synthetic=False)
        material = self.kb.ingest(input_data(real),"builder")
        with self.assertRaises(KnowledgeError):
            self.kb.verify_source(material,"unauthorized domain","reviewer")

    def test_cross_product_and_same_product_cross_edition(self):
        frag = self.kb.fragments(self.m)[0]["id"]
        first = self.candidate()
        self.kb.review(first,decision(),"reviewer")
        for version in (self.new_version("2"),self.new_version("1","Other synthetic")):
            other = self.kb.ingest(input_data(version),"builder")
            self.kb.verify_source(other,"fixture","reviewer")
            with self.assertRaises(KnowledgeError):
                self.candidate(make_adapter(evidence=frag),other)
            with self.assertRaises(KnowledgeError):
                self.kb.release(version,{"candidate_ids":[first],"expected_head":None},"publisher")
            self.assertIsNone(self.kb.lookup(version,"waiting_period","sales")["fact_id"])

    def test_invalid_model_records_failure(self):
        adapter = make_adapter()
        with patch("knowledge_extract.extract",return_value=[{"review_status":"approved"}]):
            with self.assertRaises(KnowledgeError):
                self.candidate(adapter)
        state = self.kb.snapshot()
        self.assertEqual(state["candidates"],[])
        self.assertEqual(state["tasks"][-1]["status"],"failed")

    def test_number_and_unit_invalid(self):
        for value in ("99 days","30 months"):
            ident = self.candidate(make_adapter(value))
            check = next(x for x in self.kb.snapshot()["candidates"] if x["id"]==ident)["checks"]
            self.assertIn("E02:number_or_unit_mismatch",check)
            with self.assertRaises(KnowledgeError):
                self.kb.review(ident,decision(),"reviewer")

    def test_release_approval_conflict_duplicates_and_restore(self):
        ident = self.candidate()
        with self.assertRaises(KnowledgeError):
            self.publish(ident)
        self.kb.review(ident,decision(),"reviewer")
        first = self.publish(ident)
        duplicate = self.candidate()
        with self.assertRaises(KnowledgeError):
            self.kb.review(duplicate,decision(),"reviewer")
        self.kb.review(duplicate,decision(target="disputed"),"reviewer")
        other = self.candidate(make_adapter("30 days","other_benefit"))
        self.kb.review(other,decision(),"reviewer")
        with self.assertRaises(KnowledgeError):
            self.publish(ident,other,previous=first)
        self.kb.review(duplicate,decision("disputed","rejected"),"reviewer")
        second = self.publish(ident,other,previous=first)
        with self.assertRaises(KnowledgeError):
            self.publish(ident,other,previous=second)
        self.assertEqual(self.kb.lookup(self.v,"other_benefit","sales")["fact_id"],other)
        self.kb.restore(self.v,{"release_id":first,"expected_head":second,"reason":"fixture rollback"},"publisher")
        self.assertIsNone(self.kb.lookup(self.v,"other_benefit","sales")["fact_id"])
        with self.kb.db() as c:
            self.assertEqual(c.execute("SELECT COUNT(*) FROM kg_release").fetchone()[0],2)
            self.assertEqual(c.execute("SELECT COUNT(*) FROM kg_audit WHERE action='query'").fetchone()[0],2)

    def test_review_creates_new_revision_and_keeps_before_after(self):
        bad = self.candidate(make_adapter("500"))
        fid = self.kb.fragments(self.m)[0]["id"]
        replacement = json.loads(make_adapter()((None,json.dumps([{"fragment_id":fid}]))))["candidates"][0]
        corrected = self.kb.review(bad,decision(target="needs_revision",replacement=replacement,errors=["E02"]),"reviewer")
        self.kb.review(corrected,decision(),"reviewer")
        with self.kb.db() as c:
            event = c.execute("SELECT * FROM kg_review WHERE candidate_id=?",(bad,)).fetchone()
            self.assertNotEqual(event["before"],event["after"])
            self.assertEqual(event["actor"],"reviewer")

    def test_model_configuration_missing_and_errors_redacted(self):
        with patch.dict("os.environ",{},clear=True):
            with self.assertRaisesRegex(KnowledgeError,"缺少有效模型配置"):
                QwenAdapter()
        env = {"BAOZHI_MODEL_URL":"https://example.invalid/chat","BAOZHI_MODEL":"qwen-test",
               "BAOZHI_API_KEY":"private-test-secret"}
        with patch.dict("os.environ",env,clear=True), patch("knowledge_extract.urlopen",side_effect=TimeoutError("private-test-secret")) as call:
            with self.assertRaises(KnowledgeError) as failed:
                self.candidate(QwenAdapter())
            self.assertNotIn(env["BAOZHI_API_KEY"],str(failed.exception))
            self.assertEqual(call.call_count,2)

    def test_release_rechecks_source_and_quote(self):
        ident = self.candidate()
        self.kb.review(ident,decision(),"reviewer")
        with self.kb.db(True) as c:
            c.execute("UPDATE kg_material SET verified=0 WHERE id=?", (self.m,))
        with self.assertRaises(KnowledgeError):
            self.publish(ident)
        self.kb.verify_source(self.m,"source rechecked","reviewer")
        with self.kb.db(True) as c:
            c.execute("UPDATE kg_evidence SET quote='altered' WHERE candidate_id=?", (ident,))
        with self.assertRaises(KnowledgeError):
            self.publish(ident)
        self.assertEqual(self.kb.snapshot()["releases"],[])

    def test_approval_with_error_and_invalid_evidence_is_blocked(self):
        ident = self.candidate()
        with self.assertRaises(KnowledgeError):
            self.kb.review(ident,decision(errors=["E03"]),"reviewer")
        with self.kb.db(True) as c:
            c.execute("UPDATE kg_page SET quality='needs_review' WHERE material_id=?", (self.m,))
        with self.assertRaises(KnowledgeError):
            self.kb.review(ident,decision(),"reviewer")

    def test_restore_rechecks_target_source_and_preserves_head(self):
        first_fact = self.candidate()
        self.kb.review(first_fact,decision(),"reviewer")
        first = self.publish(first_fact)
        other_material = self.kb.ingest({**input_data(self.v),
              "source":"https://fixture.invalid/other.pdf"},"builder")
        self.kb.verify_source(other_material,"fixture","reviewer")
        second_fact = self.candidate(make_adapter("30 days","other_benefit"),other_material)
        self.kb.review(second_fact,decision(),"reviewer")
        second = self.publish(second_fact,previous=first)
        with self.kb.db(True) as c:
            c.execute("UPDATE kg_material SET verified=0 WHERE id=?", (self.m,))
        with self.assertRaises(KnowledgeError):
            self.kb.restore(self.v,{"release_id":first,"expected_head":second,"reason":"fixture"},"publisher")
        self.assertEqual(self.kb.lookup(self.v,"other_benefit","sales")["release_id"],second)

    def test_failed_extraction_keeps_safe_response(self):
        adapter = make_adapter()
        adapter.last_response = '{"candidates":[{"unexpected":"field"}]}'
        with patch("knowledge_extract.extract",return_value=[{"unexpected":"field"}]):
            with self.assertRaises(KnowledgeError):
                self.candidate(adapter)
        failed = next(t for t in self.kb.snapshot()["tasks"] if t["stage"]=="extract")
        self.assertEqual(json.loads(failed["result"])["model_response"],adapter.last_response)

class KnowledgeHTTPTests(unittest.TestCase):
    def test_loopback_upload_extract_review_publish_sales_and_permissions(self):
        with TemporaryDirectory() as temp:
            path = Path(temp) / "test.sqlite"
            app = Store(path)
            app.knowledge = KnowledgeStore(path,migrate=True)
            app.knowledge_sales_versions = set()
            server = Server(("127.0.0.1",0),app)
            server.knowledge_credentials = {"test-builder":"builder","test-reviewer":"reviewer","test-publisher":"publisher"}
            thread = threading.Thread(target=server.serve_forever,daemon=True)
            thread.start()
            try:
                self.exercise(server,app)
            finally:
                server.shutdown()
                server.server_close()
                thread.join()

    def exercise(self, server, app):
        root = f"http://127.0.0.1:{server.server_port}"
        kg = "/api/knowledge/v1/"
        def call(path, data=None, token="", expected=200, lang="zh"):
            req = Request(root+path, json.dumps(data).encode() if data is not None else None,
                          {"Content-Type":"application/json","Authorization":"Bearer "+token,"X-Baosu-Lang":lang})
            try:
                with urlopen(req,timeout=5) as response:
                    self.assertEqual(response.status,expected)
                    return json.load(response) if response.headers.get_content_type()=="application/json" else response.read()
            except HTTPError as e:
                self.assertEqual(e.code,expected)
                return json.load(e)
        self.assertIn(b"knowledge.js",call("/classic/knowledge.html"))
        self.assertIn(b"<html",call("/"))
        self.assertIn(b"<html",call("/classic/"))
        customer = call("/api/session",{"role":"customer"})["token"]
        sales = call("/api/session",{"role":"sales"})["token"]
        call(kg+"state",token=sales,expected=403)
        version = call(kg+"versions",{"name":"Fixture","insurer":"Test","filing":"1","edition":"1",
                                      "synthetic":True},"test-builder")["id"]
        material = call(kg+"materials",input_data(version),"test-builder")["id"]
        call(kg+"verify/"+material,{"reason":"checked fixture"},"test-reviewer")
        self.assertTrue(call(kg+"fragments/"+material,token="test-reviewer"))
        self.assertTrue(call(kg+"original/"+material,token="test-reviewer").startswith(b"%PDF-"))
        call(kg+"original/"+material,token=customer,expected=403)
        call(kg+"tables/"+material,token=customer,expected=403)
        call(kg+"table-parse/"+material,{},customer,403)
        call(kg+"table-parse/"+material,{},"test-reviewer",403)
        call(kg+"table-parse/"+material,{},"test-builder",422)
        from test_knowledge_tables import dense_pdf
        table_material=call(kg+"materials",{**input_data(version,raw=dense_pdf()),
                            "kind":"cash_value"},"test-builder")["id"]
        parsed=call(kg+"table-parse/"+table_material,{},"test-builder")
        self.assertEqual(parsed["table_count"],2)
        self.assertNotIn("tables",parsed)
        self.assertEqual(len(call(kg+"tables/"+table_material,token="test-reviewer")["tables"]),2)
        with patch("knowledge_http.QwenAdapter",return_value=make_adapter()):
            candidate = call(kg+"extract/"+material,{},"test-builder")["candidate_ids"][0]
        call(kg+"review/"+candidate,decision(),customer,403)
        call(kg+"review/"+candidate,decision(),"test-builder",403)
        data = {"candidate_ids":[candidate],"expected_head":None}
        call(kg+"publish/"+version,data,customer,403)
        call(kg+"publish/"+version,data,"test-publisher",409)
        call(kg+"review/"+candidate,{**decision(),"actor":"forged"},"test-reviewer")
        published = call(kg+"publish/"+version,data,"test-publisher")["release_id"]
        with app.db() as c:
            operator = c.execute("SELECT id FROM company_staff WHERE duty='sales' LIMIT 1").fetchone()[0]
            context = c.execute("SELECT id FROM company_customers LIMIT 1").fetchone()[0]
            self.assertEqual(c.execute("SELECT actor FROM kg_review").fetchone()[0],"local:reviewer")
        request = {"channel":"sales","duty":"sales","operator":operator,"context":context,
                   "text":"查合同字段","consult_mode":"knowledge","product_version_id":version,
                   "fact_type":"waiting_period"}
        call("/api/channel",request,sales,403)
        app.knowledge_sales_versions.add(version)
        self.assertEqual(call("/api/knowledge-sales-options",token=sales)[0]["id"],version)
        call("/api/knowledge-sales-options",token=customer,expected=403)
        call("/api/channel",request,customer,403)
        call("/api/channel",request,sales,403,lang="en")
        response = call("/api/channel",request,sales)
        self.assertIn("合成",response["answer"])
        self.assertEqual(response["trace"]["knowledge"]["release_id"],published)
        self.assertEqual(response["trace"]["knowledge"]["fact_id"],candidate)
        self.assertTrue(response["excerpts"][0]["evidence_id"])
        with patch("knowledge_http.QwenAdapter",return_value=make_adapter("30 days","other_benefit")):
            extra = call(kg+"extract/"+material,{},"test-builder")["candidate_ids"][0]
        call(kg+"review/"+extra,decision(),"test-reviewer")
        second = call(kg+"publish/"+version,{"candidate_ids":[candidate,extra],"expected_head":published},
                      "test-publisher")["release_id"]
        call(kg+"restore/"+version,{"release_id":published,"expected_head":second,"reason":"Fixture rollback"},
             "test-publisher")
        request["fact_type"] = "other_benefit"
        self.assertIsNone(call("/api/channel",request,sales)["trace"]["knowledge"]["fact_id"])
        self.assertEqual(len(call(kg+"state",token="test-reviewer")["releases"]),2)
