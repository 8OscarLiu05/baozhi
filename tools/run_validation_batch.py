"""Run the frozen BaoSu validation set against a copied database.

The script performs technical pre-checks only. It never fills insurance reviewer
judgements and never writes to the live database.
"""
from __future__ import annotations

import argparse
import csv
import json
import shutil
import statistics
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import app
import intl


def payload_for(case: dict) -> tuple[dict, str]:
    channel = case["channel"]
    duty = case.get("duty") or ("sales" if channel == "sales" else "customer")
    operator = case.get("operator") or ("展业-01" if duty == "sales" else "客户-01")
    context = case.get("context") or "客户-01"
    return {
        "channel": channel,
        "duty": duty,
        "operator": operator,
        "context": context,
        "policy": case.get("policy", ""),
        "text": case["question"],
        "consult_mode": case["route"],
    }, duty


def auto_check(case: dict, result: dict) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    answer = result.get("answer", "")
    trace = result.get("trace") or {}
    model_call = trace.get("model_call") or {}
    evidence = result.get("excerpts") or []
    for token in case.get("expected_substrings", []):
        if token not in answer:
            reasons.append(f"最终答案缺少：{token}")
    expected_count = case.get("expected_model_count")
    if expected_count is not None and model_call.get("count", 0) != expected_count:
        reasons.append(f"模型调用次数={model_call.get('count', 0)}，预期={expected_count}")
    minimum = int(case.get("expected_evidence_min", 0))
    if len(evidence) < minimum:
        reasons.append(f"证据数={len(evidence)}，至少应为{minimum}")
    expected_rule = case.get("expected_rule")
    if expected_rule and expected_rule not in (trace.get("rule_category") or ""):
        reasons.append(f"未记录规则：{expected_rule}")
    if case["route"] in ("general",) and evidence:
        reasons.append("普通咨询不应附公司资料")
    if case["group"] == "普通咨询和岗位方法题" and (trace.get("product_id") or evidence):
        reasons.append("一般问题不应携带产品字段或公司资料")
    if not result.get("call_id"):
        reasons.append("缺少调用编号")
    return not reasons, reasons


def serialize_result(case: dict, result: dict, passed: bool, reasons: list[str]) -> dict:
    trace = result.get("trace") or {}
    model = trace.get("model_call") or {}
    evidence = result.get("excerpts") or []
    return {
        "case_id": case["case_id"],
        "group": case["group"],
        "product_id": case.get("product_id", ""),
        "channel": case["channel"],
        "route": case["route"],
        "question": case["question"],
        "call_id": result.get("call_id", ""),
        "status": result.get("status", ""),
        "answer": result.get("answer", ""),
        "evidence_count": len(evidence),
        "evidence": evidence,
        "trace": trace,
        "model_count": model.get("count", 0),
        "model_status": model.get("status", result.get("status", "")),
        "model_adopted": bool(model.get("adopted", False)),
        "elapsed_ms": model.get("ms", ""),
        "auto_pass": passed,
        "auto_reasons": reasons,
        "human_review_status": "待两位保险成员独立复核",
    }


def write_csv(path: Path, rows: list[dict], fields: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            cooked = dict(row)
            for key, value in cooked.items():
                if isinstance(value, (dict, list)):
                    cooked[key] = json.dumps(value, ensure_ascii=False)
            writer.writerow(cooked)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", default="VAL-20261018-01")
    args = parser.parse_args()
    out = ROOT / "docs" / "验证" / args.batch
    frozen = out / "snapshot" / "baozhi.sqlite3"
    if not frozen.exists():
        raise SystemExit(f"missing frozen database: {frozen}")
    cases = json.loads((ROOT / "tools" / "validation_cases_20261018.json").read_text(encoding="utf-8"))
    run_db = out / "run" / "validation-run.sqlite3"
    run_db.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(frozen, run_db)
    app.load_local_env()
    intl.LANG.set("zh")
    store = app.Store(run_db)
    rows: list[dict] = []
    first_call = ""
    for case in cases:
        if case["route"] == "review":
            if not first_call:
                raise SystemExit("review case requires an earlier call")
            before = store.channel_calls("platform", query=first_call)["calls"][0]
            review = store.sample_review({"call_id": first_call, "action": "need_knowledge", "note": "已核对本批次原文；该意见仅追加，不改原回答。"}, "platform")
            after = store.channel_calls("platform", query=first_call)["calls"][0]
            passed = before["answer"] == after["answer"] and after.get("review") is not None
            result = {
                "call_id": first_call,
                "status": "reviewed",
                "answer": after["answer"],
                "excerpts": after.get("excerpts") or [],
                "trace": {"review": review, "answer_unchanged": before["answer"] == after["answer"], "model_call": {"count": 0, "status": "not_applicable", "adopted": False, "ms": 0}},
            }
            rows.append(serialize_result(case, result, passed, [] if passed else ["追加处置后原回答发生变化或复核记录未保存"]))
            continue
        payload, role = payload_for(case)
        try:
            result = store.channel_ask(payload, role)
            passed, reasons = auto_check(case, result)
        except Exception as exc:  # preserve the case instead of deleting a failure
            result = {"answer": "", "status": "exception", "excerpts": [], "trace": {"exception": f"{type(exc).__name__}: {exc}", "model_call": {"count": 0, "status": "exception", "adopted": False, "ms": 0}}}
            passed, reasons = False, [f"执行异常：{type(exc).__name__}: {exc}"]
        if result.get("call_id") and not first_call:
            first_call = result["call_id"]
        rows.append(serialize_result(case, result, passed, reasons))

    out.mkdir(parents=True, exist_ok=True)
    (out / "题目清单.json").write_text(json.dumps(cases, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / "逐题结果.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    case_fields = ["case_id", "group", "product_id", "product", "channel", "route", "question", "standard_points", "conditions", "exceptions", "citation", "metrics"]
    write_csv(out / "题目清单.csv", cases, case_fields)
    result_fields = ["case_id", "group", "product_id", "channel", "route", "question", "call_id", "status", "answer", "evidence_count", "evidence", "model_count", "model_status", "model_adopted", "elapsed_ms", "auto_pass", "auto_reasons", "human_review_status"]
    write_csv(out / "逐题结果.csv", rows, result_fields)

    flow = [{"case_id": row["case_id"], "group": row["group"], "auto_pass": row["auto_pass"], "reason": "；".join(row["auto_reasons"]), "call_id": row["call_id"]} for row in rows]
    write_csv(out / "流程检查.csv", flow, ["case_id", "group", "auto_pass", "reason", "call_id"])

    grouped = []
    for group in dict.fromkeys(case["group"] for case in cases):
        part = [row for row in rows if row["group"] == group]
        times = [int(row["elapsed_ms"]) for row in part if str(row["elapsed_ms"]).isdigit()]
        grouped.append({
            "group": group,
            "n": len(part),
            "auto_pass": sum(bool(row["auto_pass"]) for row in part),
            "model_calls": sum(int(row["model_count"] or 0) for row in part),
            "model_adopted": sum(bool(row["model_adopted"]) for row in part),
            "median_ms": statistics.median(times) if times else "",
            "max_ms": max(times) if times else "",
        })
    write_csv(out / "运行统计.csv", grouped, ["group", "n", "auto_pass", "model_calls", "model_adopted", "median_ms", "max_ms"])

    review_rows = []
    for case, row in zip(cases, rows):
        review_rows.append({
            "case_id": case["case_id"], "question": case["question"], "standard_points": case["standard_points"], "conditions": case["conditions"], "exceptions": case["exceptions"], "citation": case["citation"],
            "answer": row["answer"], "call_id": row["call_id"],
            "reviewer_a_fact": "待评", "reviewer_a_condition": "待评", "reviewer_a_evidence": "待评", "reviewer_a_handling": "待评", "reviewer_a_note": "",
            "reviewer_b_fact": "待评", "reviewer_b_condition": "待评", "reviewer_b_evidence": "待评", "reviewer_b_handling": "待评", "reviewer_b_note": "",
            "adjudication": "待评", "final_note": "",
        })
    review_fields = list(review_rows[0])
    write_csv(out / "人工复核表.csv", review_rows, review_fields)

    total = len(rows)
    passed = sum(bool(row["auto_pass"]) for row in rows)
    metric = {
        "batch_id": args.batch,
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "application": {"version": app.VERSION, "build": app.BUILD},
        "technical_precheck": {"executed": total, "passed": passed, "failed": total - passed, "rate": passed / total if total else None},
        "model": {"calls": sum(int(row["model_count"] or 0) for row in rows), "adopted": sum(bool(row["model_adopted"]) for row in rows)},
        "human_metrics": {"status": "pending", "fact_accuracy": None, "condition_completeness": None, "evidence_support": None, "appropriate_handling": None, "note": "待两位保险成员独立复核及分歧裁定；不得用技术预检查替代。"},
        "groups": grouped,
    }
    (out / "指标汇总.json").write_text(json.dumps(metric, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metric, ensure_ascii=False, indent=2))
    return 0 if passed == total else 2


if __name__ == "__main__":
    raise SystemExit(main())
