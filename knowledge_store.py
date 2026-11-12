"""Opt-in knowledge governance. Legacy tables are deliberately outside this service."""
import base64
from contextlib import contextmanager
from datetime import datetime, timezone
from hashlib import sha256
import io
import json
import re
import sqlite3
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

KINDS = {"terms", "brochure", "application_notice", "rider", "rates", "cash_value",
         "illustration", "service_rules", "conversion_table"}
OFFICIAL_HOSTS = {"www.iachina.cn", "www.cpic.com.cn", "cpic.com.cn", "www.chinalife.com.cn"}
TABLE_KINDS = {"rates", "cash_value", "conversion_table", "illustration"}
FACT_KEYS = {"product_name", "filing_number", "entry_age", "payment_method", "payment_term",
             "coverage_term", "annuity_start", "annuity_age", "annuity_method",
             "annuity_frequency", "annuity_amount", "guaranteed_period", "death_benefit",
             "exclusions", "cash_value", "non_guaranteed_benefit", "waiting_period",
             "service_rule", "eligibility", "other_benefit"}
MISSING = {"explicitly_not_applicable", "not_mentioned", "not_found", "attachment_missing", "undetermined"}
CONDITIONAL = {"annuity_start", "annuity_age", "annuity_amount", "death_benefit", "exclusions"}
GUARANTEE = {"guaranteed", "non_guaranteed", "illustration", "not_applicable", "unknown"}
ERRORS = {f"E{i:02d}" for i in range(1, 11)}
HEAD = re.compile(r"(?m)^[ \t]*(\d+(?:[.．]\d+){1,3})[ \t　]+([^\n]{1,70})|^[ \t]*(第[一二三四五六七八九十百0-9]+条)[ \t　]*([^\n]{0,70})")
NUM = re.compile(r"(?<![0-9])\d+(?:\.\d+)?\s*(周岁|岁|日|天|个月|月|年|元|%|％|次|days?\b|months?\b|years?\b|USD\b|CNY\b)?", re.I)

class KnowledgeError(Exception):
    def __init__(self, message, status=422):
        super().__init__(message)
        self.status = status

def require(test, message, status=422):
    if not test:
        raise KnowledgeError(message, status)

def clean(value, maxlen=300):
    require(isinstance(value, str) and 0 < len(value.strip()) <= maxlen, "缺少有效文本或超出长度")
    return value.strip()

def enum(value, options):
    require(isinstance(value, str) and value in options, "字段枚举值无效")
    return value

def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False)

def now():
    return datetime.now(timezone.utc).isoformat()

def uid():
    return uuid4().hex

def row(c, sql, *values):
    result = c.execute(sql, values).fetchone()
    require(result is not None, "记录不存在", 404)
    return result

def parse_pdf(raw):
    require(isinstance(raw, bytes) and 0 < len(raw) <= 8 * 1024 * 1024
            and raw.startswith(b"%PDF-") and b"%%EOF" in raw[-2048:], "PDF 签名、大小或尾标无效")
    try:
        from pypdf import PdfReader
    except ImportError:
        raise KnowledgeError("需安装 requirements.txt 中的 PDF 依赖", 503) from None
    try:
        pdf = PdfReader(io.BytesIO(raw), strict=True)
        require(not pdf.is_encrypted and 0 < len(pdf.pages) <= 100, "PDF 已加密或页数超限")
        pages = []
        for i, page in enumerate(pdf.pages, 1):
            contents = page.get_contents()
            require(contents is None or len(contents.get_data()) <= 8 * 1024 * 1024, "单页解压内容过大")
            text = page.extract_text() or ""
            require(len(text) <= 100_000, "单页文本超限")
            quality = "needs_review" if len(text.strip()) < 20 or "\ufffd" in text else "text"
            labels = pdf.trailer["/Root"].get("/PageLabels")
            printed = re.search(r"（第([一二三四五六七八九十0-9]+)页）", text[:160])
            pages.append((i, pdf.page_labels[i-1] if labels else printed[1] if printed else None, text, quality))
        return pages
    except KnowledgeError:
        raise
    except Exception:
        raise KnowledgeError("PDF 无法完整解析") from None

def parse_table_locations(raw):
    """Preserve detected grid cells and coordinates without inferring merged headers."""
    from knowledge_tables import extract_tables
    return extract_tables(raw)

class KnowledgeStore:
    def __init__(self, path, *, migrate=False):
        self.path = Path(path).resolve()
        require(self.path.is_file(), "知识功能需要显式指定已有的隔离数据库", 409)
        protected = (Path("D:/baozhi/data/baozhi.sqlite3"), Path(__file__).parent / "data/baozhi.sqlite3")
        require(not any(p.is_file() and p.samefile(self.path) for p in protected),
                "知识底座禁止使用受保护数据库", 409)
        with self.db(write=migrate) as c:
            found = c.execute("SELECT 1 FROM sqlite_master WHERE name='kg_migration'").fetchone()
            if not found and migrate:
                for ddl in Path(__file__).with_name("knowledge_schema.sql").read_text().split(";"):
                    if ddl.strip():
                        c.execute(ddl)
                c.execute("INSERT INTO kg_migration VALUES(1,?)", (now(),))
            else:
                require(found and [r[0] for r in c.execute("SELECT version FROM kg_migration")] == [1],
                        "知识库未迁移或迁移版本不兼容", 409)

    @contextmanager
    def db(self, write=False):
        conn = sqlite3.connect(self.path.as_uri() + ("?mode=rw" if write else "?mode=ro"), uri=True)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA foreign_keys=ON")
            if write:
                conn.execute("BEGIN IMMEDIATE")
            with conn:
                yield conn
        finally:
            conn.close()

    def audit(self, c, actor, action, target, detail):
        c.execute("INSERT INTO kg_audit(actor,action,target,detail,created) VALUES(?,?,?,?,?)",
                  (actor, action, target, encode(detail), now()))

    def version(self, data, actor):
        insurer, name, filing, edition = (clean(data.get(k)) for k in ("insurer","name","filing","edition"))
        synthetic = data.get("synthetic", False)
        require(type(synthetic) is bool, "synthetic 必须是布尔值")
        with self.db(True) as c:
            c.execute("INSERT OR IGNORE INTO kg_product VALUES(?,?,?)", (uid(), insurer, name))
            product = row(c, "SELECT id FROM kg_product WHERE insurer=? AND name=?", insurer, name)["id"]
            ident = uid()
            try:
                c.execute("INSERT INTO kg_version VALUES(?,?,?,?,?)", (ident, product, filing, edition, int(synthetic)))
            except sqlite3.IntegrityError:
                raise KnowledgeError("合同版次已登记", 409) from None
            self.audit(c, actor, "version", ident, {"synthetic": synthetic})
            return ident

    def ingest(self, data, actor):
        version = clean(data.get("version_id"))
        filename = clean(data.get("filename"))
        require(filename.lower().endswith(".pdf") and not re.search(r"[/\\]", filename), "需要 PDF 文件名")
        kind = enum(data.get("kind"), KINDS)
        source = clean(data.get("source"), 1000)
        try:
            url = urlsplit(source)
            port = url.port
        except ValueError:
            raise KnowledgeError("来源 URL 无效") from None
        require(url.scheme == "https" and url.hostname and not url.username and not url.password
                and not url.fragment and not url.query and port in (None,443), "需要无凭据的 HTTPS 来源 URL")
        try:
            raw = base64.b64decode(data.get("file", ""), validate=True)
        except (TypeError, ValueError):
            raise KnowledgeError("文件编码无效") from None
        pages = parse_pdf(raw)
        tables = parse_table_locations(raw) if kind in TABLE_KINDS else {}
        if kind in TABLE_KINDS:
            pages = [(i,label,text,"needs_review") for i,label,text,quality in pages]
        digest = sha256(raw).hexdigest()
        with self.db(True) as c:
            row(c, "SELECT id FROM kg_version WHERE id=?", version)
            old = c.execute("SELECT id FROM kg_material WHERE version_id=? AND kind=? AND sha256=? AND source=?",
                            (version, kind, digest, source)).fetchone()
            if old:
                return old[0]
            attachment = data.get("attachment_of") or None
            if attachment:
                row(c, "SELECT id FROM kg_material WHERE id=? AND version_id=?", clean(attachment), version)
            c.execute("INSERT OR IGNORE INTO kg_asset VALUES(?,?,?)", (digest, len(raw), raw))
            ident = uid()
            rev = c.execute("SELECT coalesce(max(revision),0)+1 FROM kg_material WHERE version_id=? AND kind=?",
                            (version, kind)).fetchone()[0]
            c.execute("""INSERT INTO kg_material(id,version_id,sha256,kind,filename,source,observed,
                      attachment_of,revision,page_count) VALUES(?,?,?,?,?,?,?,?,?,?)""",
                      (ident, version, digest, kind, filename, source, now(), attachment, rev, len(pages)))
            c.executemany("INSERT INTO kg_page VALUES(?,?,?,?,?)", [(ident, *page) for page in pages])
            for page, _, text, _ in pages:
                matches = list(HEAD.finditer(text))
                cuts = sorted({0, len(text), *(m.start() for m in matches)})
                headings = {m.start(): (m[1] or m[3], (m[2] or m[4] or "").strip()) for m in matches}
                for start, stop in zip(cuts, cuts[1:]):
                    clause, title = headings.get(start, (None, None))
                    location = encode({"tables":tables[page],"header_review_required":True}) if start == 0 and tables.get(page) else None
                    c.execute("INSERT INTO kg_fragment VALUES(?,?,?,?,?,?,?,?,?)",
                              (uid(), version, ident, page, clause, title, start, stop, location))
            task = uid()
            c.execute("INSERT INTO kg_task VALUES(?,?,?,?,?,?,?,?,?)",
                      (task, version, ident, "parse",
                       "needs_review" if any(p[-1] != "text" for p in pages) else "succeeded",
                       "pypdf", "page-fragments-v2", None, now()))
            self.audit(c, actor, "ingest", ident, {"sha256": digest, "task": task})
            return ident

    def verify_source(self, ident, reason, actor):
        reason = clean(reason, 2000)
        with self.db(True) as c:
            m = row(c, """SELECT m.*, v.synthetic FROM kg_material m JOIN kg_version v ON v.id=m.version_id
                       WHERE m.id=?""", ident)
            require(urlsplit(m["source"]).hostname in OFFICIAL_HOSTS or m["synthetic"],
                    "来源域名不在试点官方清单")
            c.execute("UPDATE kg_material SET verified=1 WHERE id=?", (ident,))
            self.audit(c, actor, "verify_source", ident, {"reason": reason})

    def fragments(self, material):
        with self.db() as c:
            row(c, "SELECT id FROM kg_material WHERE id=?", material)
            return [dict(r) for r in c.execute("""SELECT f.*,p.printed_page,p.quality,
                substr(p.text,f.start+1,f.stop-f.start) AS text FROM kg_fragment f JOIN kg_page p
                ON (f.material_id,f.page)=(p.material_id,p.page) WHERE f.material_id=? ORDER BY f.page,f.start""", (material,))]

    def original(self, material):
        with self.db() as c:
            asset = row(c, "SELECT a.pdf,a.sha256 FROM kg_material m JOIN kg_asset a USING(sha256) WHERE m.id=?", material)
            require(sha256(asset["pdf"]).hexdigest() == asset["sha256"], "原件哈希校验失败", 409)
            return asset["pdf"]

    def reparse_tables(self, material, actor):
        from knowledge_tables import PARSER_VERSION
        raw = self.original(material)
        tables = parse_table_locations(raw)
        with self.db(True) as c:
            m = row(c, "SELECT * FROM kg_material WHERE id=?", material)
            require(m["kind"] in TABLE_KINDS, "仅表格类资料可执行网格解析")
            task = uid()
            summary = {"table_count":sum(len(v) for v in tables.values()),
                       "page_count":len(tables),"professional_status":"needs_review",
                       "source_sha256":m["sha256"],"tables":tables}
            c.execute("INSERT INTO kg_task VALUES(?,?,?,?,?,?,?,?,?)",
                      (task,m["version_id"],material,"table_parse","needs_review",
                       "pdfplumber",PARSER_VERSION,encode(summary),now()))
            self.audit(c,actor,"table_parse",task,{"material_id":material,
                                                "table_count":summary["table_count"]})
            return {"task_id":task,**summary}

    def tables(self, material):
        with self.db() as c:
            row(c,"SELECT id FROM kg_material WHERE id=?",material)
            task=c.execute("""SELECT id,result FROM kg_task WHERE material_id=? AND stage='table_parse'
                              ORDER BY created DESC,id DESC LIMIT 1""",(material,)).fetchone()
            if task:
                return {"task_id":task["id"],**json.loads(task["result"])}
            return {"task_id":None,"tables":{},"professional_status":"not_parsed"}

    def snapshot(self):
        with self.db() as c:
            queries = {
                "versions": "SELECT v.*,p.name,p.insurer FROM kg_version v JOIN kg_product p ON p.id=v.product_id",
                "materials": "SELECT * FROM kg_material", "tasks": "SELECT * FROM kg_task",
                "candidates": "SELECT * FROM kg_candidate",
                "releases": "SELECT r.*, h.release_id=r.id AS active FROM kg_release r LEFT JOIN kg_head h USING(version_id)"
            }
            result = {k: [dict(r) for r in c.execute(q)] for k, q in queries.items()}
            for task in result["tasks"]:
                if task["stage"] == "table_parse" and task["result"]:
                    details = json.loads(task["result"])
                    task["result"] = encode({k:v for k,v in details.items() if k != "tables"})
            for candidate in result["candidates"]:
                candidate["payload"] = json.loads(candidate["payload"])
                candidate["checks"] = json.loads(candidate["checks"])
                candidate["evidence"] = self.evidence(c, candidate["id"])
                task = row(c, "SELECT method,config FROM kg_task WHERE id=?", candidate["task_id"])
                releases = [dict(r) for r in c.execute("""SELECT rf.release_id,
                    coalesce(h.release_id=rf.release_id,0) AS active FROM kg_release_fact rf
                    LEFT JOIN kg_head h USING(version_id) WHERE rf.candidate_id=?""", (candidate["id"],))]
                candidate.update(candidate_id=candidate["id"], product_version_id=candidate["version_id"],
                                 review_status=candidate["status"], extraction_method=task["method"],
                                 extractor_version=json.loads(task["config"])["extractor_version"],
                                 publish_status="active" if any(r["active"] for r in releases)
                                 else "historical" if releases else "not_published", release_memberships=releases)
            return result

    def evidence(self, c, ident):
        return [dict(r) for r in c.execute("""SELECT e.*,f.material_id,f.page,f.clause,f.title,p.printed_page,
            e.fragment_id || ':' || e.start || ':' || e.stop AS evidence_id,
            m.source,m.sha256,m.filename FROM kg_evidence e JOIN kg_fragment f ON f.id=e.fragment_id
            JOIN kg_material m ON m.id=f.material_id JOIN kg_page p ON (p.material_id,p.page)=(f.material_id,f.page)
            WHERE e.candidate_id=? ORDER BY f.page,e.start""", (ident,))]

    def start_extract(self, material, actor, adapter):
        from knowledge_extract import CONFIG, extract
        fragments = self.fragments(material)
        with self.db(True) as c:
            m = row(c, "SELECT * FROM kg_material WHERE id=?", material)
            require(m["verified"] and fragments, "需先核验来源并获得可定位文本", 409)
            task = uid()
            c.execute("INSERT INTO kg_task VALUES(?,?,?,?,?,?,?,?,?)",
                      (task, m["version_id"], material, "extract", "running", adapter.method,
                       encode({**CONFIG, "model": adapter.label, "source_sha256": m["sha256"]}), None, now()))
            self.audit(c, actor, "extract_start", task, {"material": material})
        try:
            output = extract(fragments, adapter)
            with self.db(True) as c:
                ids = [self.insert_candidate(c, task, item) for item in output]
                types = {item["fact_type"] for item in output if item.get("presence") == "present"}
                missing = {k: "undetermined" for k in CONFIG["pilot_fields"] if k not in types}
                c.execute("UPDATE kg_task SET status=?,result=? WHERE id=?",
                          ("succeeded" if ids else "needs_review",
                           encode({"candidate_ids": ids, "validated_response": output,
                                   "model_response": getattr(adapter, "last_response", None),
                                   "unconfirmed_fields": missing}), task))
                self.audit(c, actor, "extract_finish", task, {"count": len(ids)})
            return {"task_id": task, "candidate_ids": ids, "unconfirmed_fields": missing}
        except Exception as exc:
            with self.db(True) as c:
                c.execute("UPDATE kg_task SET status='failed',result=? WHERE id=?",
                          (encode({"error": type(exc).__name__,
                                   "message": str(exc) if isinstance(exc, KnowledgeError) else "提取异常",
                                   "model_response": getattr(adapter, "last_response", None)}), task))
                self.audit(c, actor, "extract_failed", task, {"error": type(exc).__name__})
            if isinstance(exc, KnowledgeError):
                raise
            raise KnowledgeError("提取失败，详见任务状态", 502) from None

    def insert_candidate(self, c, task_id, item, parent=None):
        keys = {"fact_type","fact_value","unit","conditions","exceptions","guarantee_type","presence","evidence"}
        require(isinstance(item, dict) and set(item) == keys, "候选字段结构无效")
        task = row(c, "SELECT * FROM kg_task WHERE id=?", task_id)
        kind = enum(item["fact_type"], FACT_KEYS)
        presence = enum(item["presence"], MISSING | {"present"})
        value = item["fact_value"]
        unit = item["unit"]
        require((presence == "present" and isinstance(value, str) and clean(value, 4000))
                or (presence != "present" and value is None), "事实值与缺失状态不匹配")
        require(unit is None or isinstance(unit, str) and clean(unit, 30), "单位无效")
        for key in ("conditions", "exceptions"):
            require(isinstance(item[key], list) and len(item[key]) <= 30, "条件或例外结构无效")
            for v in item[key]:
                clean(v, 1000)
        guarantee = enum(item["guarantee_type"], GUARANTEE)
        refs = item["evidence"]
        require(isinstance(refs, list) and len(refs) <= 25, "证据结构无效")
        ident = uid()
        checks = []
        resolved = []
        seen = set()
        for ref in refs:
            require(isinstance(ref, dict) and set(ref) == {"fragment_id","quote","role"}, "证据字段无效")
            frag = row(c, """SELECT f.*,p.text,p.quality,m.verified,m.kind FROM kg_fragment f
                JOIN kg_page p ON (p.material_id,p.page)=(f.material_id,f.page)
                JOIN kg_material m ON m.id=f.material_id WHERE f.id=? AND f.version_id=?""",
                       clean(ref["fragment_id"]), task["version_id"])
            quote = clean(ref["quote"], 4000)
            role = enum(ref["role"], {"supports","condition","exception","definition"})
            segment = frag["text"][frag["start"]:frag["stop"]]
            require(segment.count(quote) == 1, "证据必须唯一精确匹配选定片段")
            start = frag["start"] + segment.index(quote)
            key = (frag["id"], start, start+len(quote), role)
            require(key not in seen, "证据重复")
            seen.add(key)
            resolved.append((ident, task["version_id"], *key[:3], quote, role))
            if frag["quality"] != "text" or not frag["verified"]:
                checks.append("E06:source_or_page_unverified")
            supporting_kind = frag["kind"] in {"terms","rider"} or (
                frag["kind"] == "cash_value" and kind == "cash_value") or (
                frag["kind"] == "conversion_table" and kind == "annuity_amount")
            if not supporting_kind and kind != "service_rule":
                checks.append("E08:material_not_contract_evidence")
            if kind == "service_rule" and frag["kind"] != "service_rules":
                checks.append("E08:service_rule_source_required")
        support = [r[5] for r in resolved if r[6] == "supports"]
        if not support:
            checks.append("E07:missing_support")
        if presence != "present":
            checks.append("E09:" + presence)
        numbers = lambda s: {(m[0].strip().replace("％", "%").replace(" ", "").lower())
                             for m in NUM.finditer(s)}
        if value and kind not in {"filing_number","product_name"}:
            observed = numbers(" ".join(support))
            expected = numbers(value + (unit or ""))
            if not expected.issubset(observed):
                checks.append("E02:number_or_unit_mismatch")
            if unit and not any(unit in q for q in support):
                checks.append("E02:unit_missing")
        if (kind in CONDITIONAL and not item["conditions"]) or any(
                not any(r[6] == "condition" and entry in r[5] for r in resolved) for entry in item["conditions"]):
            checks.append("E03:condition_requires_evidence")
        if any(not any(r[6] == "exception" and entry in r[5] for r in resolved) for entry in item["exceptions"]) or (
                not item["exceptions"] and any(re.search("除外|不承担|但若|除另有", q) for q in support)):
            checks.append("E04:exception_requires_evidence")
        if guarantee in {"unknown","illustration"} or kind == "non_guaranteed_benefit" and guarantee != "non_guaranteed":
            checks.append("E08:guarantee_class")
        if guarantee == "guaranteed" and any(re.search("非保证|不保证|不确定", q) for q in support):
            checks.append("E08:non_guaranteed_evidence")
        payload = encode({k:v for k,v in item.items() if k != "evidence"})
        if c.execute("""SELECT 1 FROM kg_candidate WHERE version_id=? AND fact_type=? AND payload=?
                        AND status IN ('pending','approved','disputed') AND id<>?""",
                     (task["version_id"],kind,payload,parent or "")).fetchone():
            checks.append("E10:duplicate")
        checks.append("needs_review:semantic_support_and_completeness")
        c.execute("INSERT INTO kg_candidate VALUES(?,?,?,?,?,?,?,?)",
                  (ident,task["version_id"],task_id,parent,kind,payload,encode(sorted(set(checks))),"pending"))
        c.executemany("INSERT INTO kg_evidence VALUES(?,?,?,?,?,?,?)", resolved)
        return ident

    def validate_current_evidence(self, c, fact):
        """Check source bytes, locations and approval inputs again at each publication boundary."""
        require(not any(e.startswith("E") for e in json.loads(fact["checks"])),
                "候选存在未解决校验问题", 409)
        evidence = list(c.execute("""SELECT e.*,f.start AS fragment_start,f.stop AS fragment_stop,
            f.material_id,p.text,p.quality,m.verified,a.sha256,a.pdf FROM kg_evidence e
            JOIN kg_fragment f ON f.id=e.fragment_id AND f.version_id=e.version_id
            JOIN kg_page p ON (p.material_id,p.page)=(f.material_id,f.page)
            JOIN kg_material m ON m.id=f.material_id AND m.version_id=e.version_id
            JOIN kg_asset a ON a.sha256=m.sha256 WHERE e.candidate_id=? AND e.version_id=?""",
            (fact["id"],fact["version_id"])))
        require(evidence and any(e["role"] == "supports" for e in evidence), "缺少原文支持证据", 409)
        for e in evidence:
            require(e["verified"] and e["quality"] == "text" and
                    e["fragment_start"] <= e["start"] < e["stop"] <= e["fragment_stop"] and
                    e["text"][e["start"]:e["stop"]] == e["quote"] and
                    sha256(e["pdf"]).hexdigest() == e["sha256"],
                    "来源、页面、引文或原件校验已失效", 409)

    def review(self, ident, data, actor):
        decision = enum(data.get("decision"), {"approved","rejected","needs_revision","disputed"})
        reason = clean(data.get("reason"), 2000)
        errors = data.get("errors", [])
        require(isinstance(errors, list) and all(isinstance(e, str) and e in ERRORS for e in errors), "错误类别无效")
        with self.db(True) as c:
            fact = row(c, "SELECT * FROM kg_candidate WHERE id=?", ident)
            require(fact["status"] == data.get("expected_status") and fact["status"] in {"pending","disputed","needs_revision"},
                    "候选状态已改变或已终审", 409)
            if decision == "approved":
                require(not errors, "批准时不能保留未解决错误", 409)
                self.validate_current_evidence(c, fact)
                require(data.get("confirmed") is True and not any(e.startswith("E") for e in json.loads(fact["checks"])),
                        "须人工确认语义及条件，且自动校验无阻塞", 409)
                method = row(c, "SELECT method FROM kg_task WHERE id=?", fact["task_id"])[0]
                synthetic = row(c, "SELECT synthetic FROM kg_version WHERE id=?", fact["version_id"])[0]
                require(synthetic or method == "ai", "真实版本禁止审批测试提取结果", 409)
            replacement = data.get("replacement")
            require(replacement is None or decision == "needs_revision", "仅退修可创建新修订")
            new_id = self.insert_candidate(c, fact["task_id"], replacement, ident) if replacement is not None else None
            after = row(c, "SELECT payload FROM kg_candidate WHERE id=?", new_id)[0] if new_id else fact["payload"]
            c.execute("UPDATE kg_candidate SET status=? WHERE id=?", (decision, ident))
            c.execute("INSERT INTO kg_review VALUES(?,?,?,?,?,?,?,?,?)",
                      (uid(), ident, actor, decision, reason, encode(errors), fact["payload"], after, now()))
            self.audit(c, actor, "review", ident, {"decision":decision,"replacement":new_id})
            return new_id

    def head(self, c, version):
        h = c.execute("SELECT release_id FROM kg_head WHERE version_id=?", (version,)).fetchone()
        return h[0] if h else None

    def release(self, version, data, actor):
        ids = data.get("candidate_ids")
        require(isinstance(ids, list) and 0 < len(ids) <= 300 and all(isinstance(x,str) for x in ids)
                and len(set(ids)) == len(ids), "事实列表不能为空或重复")
        require("expected_head" in data, "缺少当前发布版本检查")
        with self.db(True) as c:
            row(c, "SELECT id FROM kg_version WHERE id=?", version)
            previous = self.head(c, version)
            require(previous == data["expected_head"], "发布版本已改变", 409)
            require(not c.execute("SELECT 1 FROM kg_candidate WHERE version_id=? AND status='disputed'", (version,)).fetchone(),
                    "存在未解决争议", 409)
            review_ids = []
            selected = set()
            for ident in ids:
                fact = row(c, "SELECT * FROM kg_candidate WHERE id=? AND version_id=?", ident, version)
                require(fact["status"] == "approved", "仅批准事实可以发布", 409)
                self.validate_current_evidence(c, fact)
                require(fact["fact_type"] not in selected, "同一快照含冲突字段", 409)
                selected.add(fact["fact_type"])
                review_ids.append(row(c, "SELECT id FROM kg_review WHERE candidate_id=? AND decision='approved'", ident)[0])
            for old in c.execute("SELECT id FROM kg_release WHERE version_id=?", (version,)):
                prior = {r[0] for r in c.execute("SELECT candidate_id FROM kg_release_fact WHERE release_id=?", (old[0],))}
                require(prior != set(ids), "同一事实快照已发布，可使用回滚", 409)
            release_id = uid()
            c.execute("INSERT INTO kg_release VALUES(?,?,?,?)", (release_id,version,actor,now()))
            c.executemany("INSERT INTO kg_release_fact VALUES(?,?,?,?)",
                          [(release_id,version,ident,review) for ident,review in zip(ids,review_ids)])
            self.set_head(c, version, release_id)
            self.audit(c, actor, "publish", release_id, {"previous": previous,"facts": ids})
            return release_id

    @staticmethod
    def set_head(c, version, release):
        c.execute("INSERT INTO kg_head VALUES(?,?) ON CONFLICT(version_id) DO UPDATE SET release_id=excluded.release_id",
                  (version,release))

    def restore(self, version, data, actor):
        reason = clean(data.get("reason"), 2000)
        target = clean(data.get("release_id"))
        with self.db(True) as c:
            previous = self.head(c, version)
            require(previous and previous == data.get("expected_head") and previous != target, "发布版本已变更或无须回滚", 409)
            row(c, "SELECT id FROM kg_release WHERE id=? AND version_id=?", target, version)
            for fact in c.execute("""SELECT f.* FROM kg_release_fact rf JOIN kg_candidate f
                ON f.id=rf.candidate_id WHERE rf.release_id=? AND rf.version_id=?""", (target,version)):
                self.validate_current_evidence(c, fact)
            self.set_head(c, version, target)
            self.audit(c, actor, "restore", target, {"previous": previous, "reason": reason})

    def lookup(self, version, fact_type, actor):
        enum(fact_type, FACT_KEYS)
        with self.db(True) as c:
            v = row(c, "SELECT * FROM kg_version WHERE id=?", version)
            release = self.head(c, version)
            found = c.execute("""SELECT f.* FROM kg_release_fact rf JOIN kg_candidate f ON f.id=rf.candidate_id
                              WHERE rf.release_id=? AND rf.version_id=? AND f.fact_type=?""",
                              (release,version,fact_type)).fetchone()
            result = {"product_version_id": version, "release_id": release, "synthetic": bool(v["synthetic"]),
                      "fact_id": None, "evidence": [], "reply": "此版本没有可用的已发布事实，请核对版本或转人工。"}
            if found:
                self.validate_current_evidence(c, found)
                fact = json.loads(found["payload"])
                reply = str(fact["fact_value"]) + (" " + fact["unit"] if fact["unit"] else "")
                if fact["conditions"]:
                    reply += "。条件：" + "；".join(fact["conditions"])
                if fact["exceptions"]:
                    reply += "。例外：" + "；".join(fact["exceptions"])
                if fact["guarantee_type"] == "non_guaranteed":
                    reply = "非保证利益：" + reply
                if v["synthetic"]:
                    reply = "合成测试资料：" + reply
                result.update(fact_id=found["id"], fact=fact, evidence=self.evidence(c, found["id"]), reply=reply)
            self.audit(c, actor, "query", version, result)
            return result

    def published_options(self, allowed):
        with self.db() as c:
            options = c.execute("""SELECT v.id,v.edition,v.synthetic,p.name,f.fact_type FROM kg_head h
                JOIN kg_version v ON v.id=h.version_id JOIN kg_product p ON p.id=v.product_id
                JOIN kg_release_fact rf ON rf.release_id=h.release_id
                JOIN kg_candidate f ON f.id=rf.candidate_id ORDER BY p.name,v.edition,f.fact_type""")
            return [dict(r) for r in options if r["id"] in allowed]
