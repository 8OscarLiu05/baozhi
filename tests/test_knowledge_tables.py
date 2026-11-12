from contextlib import closing
import io
import sqlite3
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from knowledge_tables import extract_tables
from knowledge_store import KnowledgeStore,KnowledgeError

def dense_pdf(offset=0):
    from reportlab.pdfgen.canvas import Canvas
    out=io.BytesIO()
    c=Canvas(out,pagesize=(200,200))
    for page,rows in enumerate(([["year/age","18","19"],["1","302","0"]],[["2","685",""],["3","1136","1157"]])):
        left=20+(offset if page else 0)
        top=100
        for i in range(4):
            c.setLineWidth(.15)
            c.line(left+20*i,top,left+20*i,top-6)
        for j in range(3):
            c.line(left,top-3*j,left+60,top-3*j)
        c.setFont("Helvetica",2.5)
        for r,values in enumerate(rows):
            for col,text in enumerate(values):
                c.drawString(left+col*20+.4,top-r*3-2.5,text)
        c.showPage()
    c.save()
    return out.getvalue()

class TableTests(unittest.TestCase):
    def test_dense_grid_preserves_zero_blank_and_continuation(self):
        parsed=extract_tables(dense_pdf())
        self.assertEqual([len(parsed[i]) for i in (1,2)],[1,1])
        first,second=parsed[1][0],parsed[2][0]
        self.assertEqual(first["rows"][1]["cells"][2]["text"],"0")
        self.assertEqual(second["rows"][0]["cells"][2]["text"],"")
        self.assertEqual(second["columns"],["year/age","18","19"])
        self.assertEqual(second["continuation_of"],{"page":1,"table_id":"p1-t1"})
        self.assertEqual(second["rows"][0]["row_label"],"2")
        self.assertIsNotNone(first["rows"][1]["cells"][1]["bbox"])

    def test_changed_geometry_is_not_assigned_previous_header(self):
        parsed=extract_tables(dense_pdf(offset=10))
        self.assertEqual(parsed[2][0]["columns"],[])
        self.assertIsNone(parsed[2][0]["continuation_of"])

    def test_missing_optional_dependency_has_explicit_empty_result(self):
        from unittest.mock import patch
        with patch.dict("sys.modules",{"pdfplumber":None}):
            self.assertEqual(extract_tables(b"ignored"),{})

    def test_reparse_keeps_old_fragments_and_logs_immutable_attempt(self):
        import base64
        with TemporaryDirectory() as temp:
            path=Path(temp)/"isolated.sqlite"
            with closing(sqlite3.connect(path)) as c:
                c.execute("CREATE TABLE legacy(id TEXT)")
            store=KnowledgeStore(path,migrate=True)
            version=store.version(dict(name="Synthetic",insurer="Fixture",filing="x",edition="x",synthetic=True),"test")
            material=store.ingest(dict(version_id=version,filename="dense.pdf",kind="cash_value",
                                      source="https://fixture.invalid/dense.pdf",
                                      file=base64.b64encode(dense_pdf()).decode()),"test")
            before=store.fragments(material)
            result=store.reparse_tables(material,"builder")
            self.assertEqual(result["table_count"],2)
            self.assertEqual(store.fragments(material),before)
            self.assertTrue(all(f["quality"]=="needs_review" for f in before))
            self.assertEqual(store.tables(material)["task_id"],result["task_id"])
            self.assertNotIn("tables",__import__("json").loads(store.snapshot()["tasks"][-1]["result"]))
