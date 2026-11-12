"""Register a locally downloaded, independently verified pilot original in the sandbox."""
import argparse
import base64
from hashlib import sha256
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from knowledge_extract import CONFIG, QwenAdapter
from knowledge_store import KnowledgeError, KnowledgeStore

SOURCE = "https://www.iachina.cn/IC/tkk/03/cba3e91a-9ca8-4588-9e98-f6189e5cfbd2_TERMS.PDF"
EXPECTED = "af568dd81dabde3a5b21d858edab51802c70d910a0784803638ba9f10e613e2e"
REVIEW_LOCATORS = {
    "product_name": [(1,None)], "filing_number": [(1,None)], "entry_age": [(1,"第二条")],
    "payment_method": [(2,"第七条")], "payment_term": [(2,"第七条")],
    "coverage_term": [(1,"第三条")], "annuity_start": [(1,"第四条")], "annuity_age": [(1,"第四条")],
    "annuity_method": [(1,"第四条"),(1,"第五条"),(2,None)], "annuity_frequency": [(1,"第四条")],
    "annuity_amount": [(1,"第五条"),(2,None)], "guaranteed_period": [(1,"第五条"),(2,None)],
    "death_benefit": [(1,"第五条"),(2,None)], "exclusions": [(2,"第六条")],
    "cash_value": [(1,"第一条"),(3,"第九条")], "non_guaranteed_benefit": [],
}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("database", type=Path)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("out", type=Path)
    parser.add_argument("--extract", action="store_true")
    args = parser.parse_args()
    protected = [Path("D:/baozhi/data/baozhi.sqlite3"), Path(__file__).resolve().parents[1] / "data/baozhi.sqlite3"]
    if not args.database.is_file() or any(p.is_file() and p.samefile(args.database) for p in protected):
        parser.error("需要已有隔离库")
    raw = args.pdf.read_bytes()
    if sha256(raw).hexdigest() != EXPECTED:
        parser.error("原件与本次核验的 SHA-256 不匹配")
    db = KnowledgeStore(args.database, migrate=True)
    actor = "local:pilot-registration"
    product = {"name":"国寿颐养人生养老年金保险","insurer":"中国人寿保险股份有限公司",
               "filing":"中国人寿〔2023〕年金保险122号","edition":"2023-122"}
    version = next((v["id"] for v in db.snapshot()["versions"]
                    if all(v[k] == val for k,val in product.items()) and not v["synthetic"]), None)
    version = version or db.version(product, actor)
    material = db.ingest({"version_id":version,"kind":"terms","filename":args.pdf.name,"source":SOURCE,
                          "file":base64.b64encode(raw).decode()}, actor)
    db.verify_source(material, "协会条款明细关联该附件；协会基本信息及原件首页均显示2023年金保险122号。", actor)
    extraction_status = "未请求真实提取"
    if args.extract:
        try:
            db.start_extract(material, actor, QwenAdapter())
            extraction_status = "已执行真实提取，所有候选待审"
        except KnowledgeError as exc:
            extraction_status = str(exc)
    state = db.snapshot()
    registration = next(m for m in state["materials"] if m["id"] == material)
    fragments = db.fragments(material)
    candidates = [c for c in state["candidates"] if c["version_id"] == version]
    fields = {c["fact_type"] for c in candidates}
    review = [{"fact_type":field,"status":"pending_professional_review" if field in fields else "undetermined",
               "candidate_ids":[c["id"] for c in candidates if c["fact_type"]==field],
               "navigation_only":[{"page":f["page"],"clause":f["clause"],"fragment_id":f["id"]}
                                  for f in fragments if (f["page"],f["clause"]) in REVIEW_LOCATORS.get(field,[])]}
              for field in CONFIG["pilot_fields"]]
    outputs = {
        "来源登记.json": {**registration,"bytes":len(raw),"product":product,
                       "official_detail":"https://www.iachina.cn/IC/tkk/01/006a722a-8a0f-4171-8fd5-35a013757798.html",
                       "official_registry":"https://www.iachina.cn/IC/tkk/02/006a722a-8a0f-4171-8fd5-35a013757798.html",
                       "pdf_valid":True,"verified_sale_status":"停售","sale_end":"2024-08-31",
                       "extraction_status":extraction_status},
        "页码与条款片段.json": fragments,
        "待审字段与工程检查.json": {"requested_fields":review,"extraction_status":extraction_status,
                           "candidate_count":len(candidates),"fragments":len(fragments),
                           "note":"导航位置供原件复核。备案号在首页图形区域，以首页和协会登记为准；未核验现金价值附件。字段无候选不代表不适用。",
                           "physical_pages":len({f["page"] for f in fragments}),
                           "candidate_checks":[{"id":c["id"],"checks":c["checks"]} for c in candidates]},
    }
    if candidates:
        outputs["真实候选事实.json"] = candidates
    args.out.mkdir(parents=True, exist_ok=True)
    for name, data in outputs.items():
        (args.out / name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(extraction_status, "pages", registration["page_count"], "fragments", len(fragments),
          "candidates", len(candidates), "version", version)

if __name__ == "__main__":
    main()
