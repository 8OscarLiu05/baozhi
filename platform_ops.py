"""中台自己使用的五名智能体。它们看知识和运行记录，不代替展业、客户或坐席回答产品问题。"""
from __future__ import annotations

import compliance_rules

IDS = ("ops-knowledge", "ops-observe", "ops-sample", "ops-grant", "ops-voice")
RULE_NAMES = {
    "promise_pay": "承诺赔付或承保",
    "yield_guarantee": "收益保证",
    "deposit_compare": "与存款或理财比较",
    "disparage": "夸大或贬低",
}


def compose(agent_id, question, products, metrics, calls, duties):
    if agent_id == "ops-knowledge":
        text = _knowledge(products)
    elif agent_id == "ops-observe":
        text = _observe(metrics, calls)
    elif agent_id == "ops-sample":
        text = _sample(question, calls)
    elif agent_id == "ops-grant":
        text = _grant(duties)
    else:
        text = "口径中枢：展业、客户自助和电话坐席先查同一份结构化字段，再各自组织说法。数字以字段和条款出处为准，三个入口不另写一套。"
    return {"text": text, "evidence": [{"id": agent_id, "title": "中台运行记录", "version": "", "kind": "mock", "position": "", "source": "本机调用留存和结构化条款", "excerpt": text[:240]}]}


def _knowledge(products):
    primary = [item["short"] for item in products if item.get("shelf") == "主产品"]
    compare = [item["short"] for item in products if item.get("shelf") == "对照"]
    return "\n".join([
        f"知识治理看到 {len(products)} 份已结构化的公开条款。",
        "主产品：" + ("、".join(primary) or "还没有"),
        "对照：" + ("、".join(compare) or "还没有"),
        "每份都走过导入、清洗、分类、结构化、发布，字段旁保留条款出处。骑安心留在早期研究，三个入口默认不检索。",
        "这一名智能体只给平台看知识结构，不在展业 APP 里向客户介绍产品。",
    ])


def _observe(metrics, calls):
    counts = {}
    for row in calls:
        counts[row.get("channel") or ""] = counts.get(row.get("channel") or "", 0) + 1
    return "\n".join([
        f"运行观测：本期调用 {metrics.get('calls', 0)}，被拦截 {metrics.get('blocked', 0)}，人工确认违规 {metrics.get('confirmed', 0)}。",
        f"最近留存里，展业 {counts.get('sales', 0)} 条，客户自助 {counts.get('self', 0)} 条，电话中心 {counts.get('phone', 0)} 条。",
        "这些数字来自三个入口交回的记录。中台自己不办理承保、报价或赔付。",
    ])


def _sample(question, calls):
    counts = {}
    for row in calls:
        for part in (row.get("rule_category") or "").split(","):
            if part:
                counts[part] = counts.get(part, 0) + 1
    lines = ["抽检研判只根据留存说明类别，并建议处置。确认、误报或需补知识都要人来点，点完也不改原来的回答。"]
    if counts:
        lines.append("已写入的类别：" + "，".join(f"{RULE_NAMES.get(key, key)} {value} 条" for key, value in counts.items()))
    else:
        lines.append("当前这批留存里还没有写入合规类别。")
    hits = compliance_rules.find(question)
    if hits:
        lines.append("你贴进来的文字命中：" + "、".join(item["name"] for item in hits) + "。若这是话术本身，建议确认违规；若只是在问条款怎么写，更像误报。")
    return "\n".join(lines)


def _grant(duties):
    lines = ["授权编排：业务职责不能新建智能体，也不能打开全量调用。"]
    for duty in duties:
        lines.append(f"{duty['name']}：{'、'.join(duty['agents']) or '没有预置智能体'}")
    lines.append("知识治理、运行观测、抽检研判、授权编排、口径中枢只给平台与知识运营，不授权给展业、客户自助和电话中心。")
    return "\n".join(lines)
