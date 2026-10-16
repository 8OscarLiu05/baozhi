"""把用户已经下载的外部条款和问答片段导入本机库。不把这些内容写成骑安心产品。"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

PRODUCT = "zijin-hospital-allowance"
TITLE = "紫金保险附加个人意外伤害住院日额津贴保险条款"
SOURCE = "紫金财产保险股份有限公司条款对照，注册编号 C00013732522021043058442。用户下载后导入，不是骑安心产品，不能据此投保或赔付。"
REVIEW = "只核对演示引用。该条款写的是意外伤害住院日额津贴；疾病住院在责任免除中。未经保险成员审定。"
ARTICLE = re.compile(r"^第[零一二三四五六七八九十百]+条")
DESKTOPS = (
    Path(r"d:\HuaweiMoveData\Users\38419\Desktop\附加保险材料"),
    Path(r"d:\HuaweiMoveData\Users\38419\Desktop\新建文件夹\附加保险材料"),
)


def external_dir(store_path=None):
    raw = os.environ.get("BAOZHI_EXTERNAL_DIR", "").strip()
    if raw:
        path = Path(raw)
        return path if path.exists() else None
    local = Path(__file__).resolve().parent / "data" / "external"
    if local.exists():
        return local
    project_db = Path(__file__).resolve().parent / "data" / "baozhi.sqlite3"
    if store_path is not None and Path(store_path).resolve() != project_db.resolve():
        return None
    for folder in DESKTOPS:
        if folder.exists():
            return folder
    return None


def clean_clause(text):
    lines = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("==="):
            continue
        if lines and not lines[-1].endswith(("。", "；", "：", "）", "》")) and not ARTICLE.match(line) and not re.match(r"^[（(]?[一二三四五六七八九十0-9]+[）)、.]", line):
            lines[-1] += line
        else:
            lines.append(line)
    return lines


def clause_blocks(text):
    blocks, current = [], []
    for line in clean_clause(text):
        if ARTICLE.match(line) and current:
            blocks.append("\n".join(current))
            current = [line]
        else:
            current.append(line)
    if current:
        blocks.append("\n".join(current))
    return [block for block in blocks if block.strip()]


def read_question(message):
    event = "提到住院" if "住院" in message else ("提到门诊" if "门诊" in message else "还没说明是不是住院")
    if "高血压" in message:
        cause = "提到高血压"
    elif "意外" in message:
        cause = "提到意外"
    elif "疾病" in message:
        cause = "提到疾病"
    else:
        cause = "还没说明原因"
    return {"event": event, "cause": cause, "note": "这只是对这句话的整理，用来确认有没有听清。不是投保、核保或赔付结论。"}


def _excerpt(value):
    if isinstance(value, dict):
        value = value.get("p") or ""
    return re.sub(r"\s+", " ", str(value)).strip()[:360]


def selected_questions(subjective, objective):
    rows = []
    if isinstance(subjective, dict):
        for title, questions in subjective.items():
            if not isinstance(questions, dict):
                continue
            if "住院津贴" not in title and "住院医疗" not in title:
                continue
            for question, body in list(questions.items())[:4]:
                excerpt = _excerpt(body)
                if excerpt:
                    rows.append((str(title)[:80], str(question)[:180], excerpt))
    if isinstance(objective, list):
        kept = 0
        for item in objective:
            blob = str(item.get("input") or "")
            if "住院津贴" not in blob and "住院日额" not in blob:
                continue
            fragment = re.search(r"片段内容[:：](.+?)用户提问[:：]", blob, re.S)
            question = re.search(r"用户提问[:：](.+)$", blob, re.S)
            if not fragment or not question:
                continue
            excerpt = re.sub(r"\s+", " ", fragment.group(1)).strip()[:360]
            ask = re.sub(r"\s+", " ", question.group(1)).strip()[:180]
            if excerpt and ask:
                rows.append(("InsQABench合同片段", ask, excerpt))
                kept += 1
            if kept >= 6:
                break
    return rows[:16]


def allowance_text(text):
    """这份下载文件后面还接了医疗、救护车和燃气意外，只保留开头的住院日额津贴。"""
    cut = text.find("附加个人意外伤害医疗保险")
    if cut > 500:
        return text[:cut]
    return text


def import_bundle(store, folder):
    folder = Path(folder)
    clause = next(folder.glob("*住院日额津贴*.md"), None)
    existing = _latest(store, PRODUCT)
    if existing and "燃气用户意外伤害" in (existing["content"] or ""):
        _remove_document(store, existing["id"])
        existing = None
    if clause and not existing:
        _backup_once(store)
        blocks = clause_blocks(allowance_text(clause.read_text(encoding="utf-8")))
        if len(blocks) < 5:
            return {"imported": False, "reason": "条款分段过少"}
        doc = store.create_document({"product": PRODUCT, "title": TITLE, "kind": "imported", "source": SOURCE, "content": "\n\n".join(blocks)}, "builder")
        benefit = _chunk(doc, "第七条", "保险责任") or doc["chunks"][0]
        exclusion = _chunk(doc, "第八条", "疾病") or benefit
        store.add_rule(doc["id"], {"scenario": "living", "outcome": "limited", "evidence_id": benefit["id"], "note": "该条只约定意外事故住院日额津贴，有起付天数和给付上限。它不是骑安心，也不研究高血压住院。"}, "builder")
        store.add_rule(doc["id"], {"scenario": "medical", "outcome": "outside", "evidence_id": benefit["id"], "note": "该条写的是每日津贴，不是按医疗发票报销。"}, "builder")
        store.add_rule(doc["id"], {"scenario": "recovery", "outcome": "outside", "evidence_id": exclusion["id"], "note": "条款没有写出院后停工收入。责任免除中的疾病住院不由这条意外津贴承担。"}, "builder")
        store.publish(doc["id"], REVIEW, "reviewer")
        store.extend_agent_products()
    with store.db() as connection:
        has_questions = connection.execute("SELECT 1 FROM external_qa").fetchone()
    added = 0
    if not has_questions:
        subjective = _read_json(folder / "clause_subjective.json")
        objective = _read_json(folder / "clause_objective.json")
        added = _import_questions(store, selected_questions(subjective, objective))
    return {"imported": True, "questions": added}


def _read_json(path):
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _latest(store, product):
    with store.db() as connection:
        row = connection.execute("SELECT * FROM documents WHERE product=? ORDER BY version DESC LIMIT 1", (product,)).fetchone()
        return dict(row) if row else None


def _remove_document(store, ident):
    with store.db() as connection:
        for table in ("rules", "chunks", "clauses"):
            connection.execute(f"DELETE FROM {table} WHERE doc_id=?", (ident,))
        connection.execute("DELETE FROM documents WHERE id=?", (ident,))


def _has_product(store, product):
    return _latest(store, product) is not None


def _chunk(doc, *needles):
    for chunk in doc["chunks"]:
        if all(needle in chunk["content"] for needle in needles):
            return chunk
    return None


def _backup_once(store):
    if not store.path.exists() or store.path.stat().st_size < 100:
        return
    folder = store.path.parent / "backups"
    folder.mkdir(exist_ok=True)
    if any(path.name.startswith("before-REQ014-") for path in folder.glob("*.sqlite3")):
        return
    import sqlite3
    from datetime import datetime
    dest = folder / f"before-REQ014-{datetime.now().strftime('%Y%m%d-%H%M%S')}.sqlite3"
    source = sqlite3.connect(store.path)
    target = sqlite3.connect(dest)
    try:
        source.backup(target)
    finally:
        target.close()
        source.close()


def _import_questions(store, rows):
    if not rows:
        return 0
    with store.db() as connection:
        if connection.execute("SELECT 1 FROM external_qa").fetchone():
            return 0
        for index, (contract, question, excerpt) in enumerate(rows, 1):
            connection.execute("INSERT INTO external_qa VALUES(?,?,?,?,?)", (f"qa{index:03d}", contract, question, excerpt, "用户下载的 InsQABench 片段，只作对照，不是骑安心条款。"))
    return len(rows)
