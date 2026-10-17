"""中台自己使用的五名智能体。它们看知识和运行记录，不代替展业、客户或坐席回答产品问题。"""
from __future__ import annotations

import compliance_rules
import intl

IDS = ("ops-knowledge", "ops-observe", "ops-sample", "ops-grant", "ops-voice")
RULE_NAMES = {
    "promise_pay": "承诺赔付或承保",
    "yield_guarantee": "收益保证",
    "deposit_compare": "与存款或理财比较",
    "disparage": "夸大或贬低",
}


def compose(agent_id, question, products, metrics, calls, duties):
    if intl.english():
        return _compose_en(agent_id, question, products, metrics, calls, duties)
    if agent_id == "ops-knowledge":
        text = _knowledge(question, products)
    elif agent_id == "ops-observe":
        text = _observe(question, metrics, calls)
    elif agent_id == "ops-sample":
        text = _sample(question, calls)
    elif agent_id == "ops-grant":
        text = _grant(duties)
    else:
        text = "口径中枢：展业、客户自助和电话坐席先查同一份结构化字段，再各自组织说法。数字以字段和条款出处为准，三个入口不另写一套。"
    return {"text": text, "evidence": [{"id": agent_id, "title": "中台运行记录", "version": "", "kind": "mock", "position": "", "source": "本机调用留存和结构化条款", "excerpt": text}]}


def _knowledge(question, products):
    primary = [item["short"] for item in products if item.get("shelf") == "主产品"]
    compare = [item["short"] for item in products if item.get("shelf") == "对照"]
    lines = [
        f"知识治理看到 {len(products)} 份已结构化的公开条款。",
        "主产品：" + ("、".join(primary) or "还没有"),
        "对照：" + ("、".join(compare) or "还没有"),
        "结构分为来源登记、原文分段、事实字段、版本与授权。字段旁保留条款位置；入口只读取已经授权并发布的资料。",
        "历史研究资料归档保留。要判断某项是否写清，请到知识库打开条款结构逐项查看。",
        "这一名智能体只给平台看知识结构，不在展业 APP 里向客户介绍产品。",
    ]
    if any(word in question for word in ("更新", "版本", "改条款")):
        lines.append("更新资料时要新建版本、重新核对字段与出处，再发布；历史调用仍保留当时版本，不能被新版本覆盖。")
    if any(word in question for word in ("出处", "证据", "原文")):
        lines.append("出处至少包括资料名、版本、段落位置和最贴切的一句原文；同段支撑多项时要标成证据偏粗。")
    if any(word in question for word in ("发布", "上架", "流程")):
        lines.append("发布顺序是：登记来源 → 分段清洗 → 提取字段 → 人工核对 → 按岗授权 → 发布。未发布资料不进入三个业务入口。")
    return "\n".join(lines)


def _observe(question, metrics, calls):
    counts = {}
    for row in calls:
        counts[row.get("channel") or ""] = counts.get(row.get("channel") or "", 0) + 1
    latest = calls[0] if calls else None
    lines = [
        f"运行观测：全库累计调用 {metrics.get('calls', 0)}，被拦截 {metrics.get('blocked', 0)}，确认违规意见 {metrics.get('confirmed', 0)}。",
        f"最近留存里，展业 {counts.get('sales', 0)} 条，客户自助 {counts.get('self', 0)} 条，电话中心 {counts.get('phone', 0)} 条。",
        (f"最新一条为 {latest.get('channel') or '未登记渠道'}，状态 {latest.get('status') or '未登记'}。" if latest else "目前还没有业务调用记录。"),
        "这些数字来自三个入口交回的记录。中台自己不办理承保、报价或赔付。",
    ]
    if any(word in question for word in ("失败", "异常", "错误")):
        failed = sum(1 for row in calls if row.get("status") == "error")
        lines.append(f"最近留存中模型异常 {failed} 条。异常时仍保留规则结果和已有证据，不能把失败包装成成功回答。")
    if any(word in question for word in ("拦截", "风险", "违规")):
        risky = sum(1 for row in calls if row.get("rule_category"))
        lines.append(f"最近留存中写入合规类别 {risky} 条。类别只是待复核信号，最终处置要由复核者追加。")
    return "\n".join(lines)


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
    lines = ["授权编排分两步：先决定谁可以调用，再决定智能体可以查哪些已发布资料。业务职责不能新建智能体，也不能打开全量调用。"]
    for duty in duties:
        lines.append(f"{duty['name']}：{'、'.join(duty['agents']) or '没有预置智能体'}")
    lines.append("知识治理、运行观测、抽检研判、授权编排、口径中枢只给平台与知识运营，不授权给展业、客户自助和电话中心。")
    lines.append("编辑入口：平台与知识运营 → 智能体授权 → 已有授权 → 选择智能体 → 调整岗位或资料 → 保存授权。只有平台与知识运营或旧维护角色可以操作，培训人员不能自己修改。此处仅提出建议，不执行保存。")
    lines.append("新建智能体默认不获得任何资料；没有勾选资料时，不能用其他产品内容补答。")
    return "\n".join(lines)


RULE_NAMES_EN = {
    "promise_pay": "Promising a payout or approval",
    "yield_guarantee": "Guaranteed returns",
    "deposit_compare": "Comparing with deposits or wealth products",
    "disparage": "Exaggeration or disparagement",
}


def _short_en(item):
    return intl.PRODUCTS.get(item.get("id"), (None, item.get("short")))[1]


def _compose_en(agent_id, question, products, metrics, calls, duties):
    if agent_id == "ops-knowledge":
        primary = [_short_en(item) for item in products if item.get("shelf") == "主产品"]
        compare = [_short_en(item) for item in products if item.get("shelf") == "对照"]
        lines = [
            f"Knowledge governance sees {len(products)} structured public clauses.",
            "Main products: " + (", ".join(primary) or "none yet"),
            "Comparison: " + (", ".join(compare) or "none yet"),
            "Each clause is stored as source registration, original text sections, fact fields, and version and access. Every field keeps its clause position; the channels only read material that is authorized and published.",
            "Older research material is archived. To see whether an item is clearly stated, open the clause structure in Sources & clauses.",
            "This agent explains the knowledge structure to the platform only; it does not present products to customers in the sales app.",
        ]
        if any(word in question for word in ("更新", "版本", "改条款")):
            lines.append("To update material, create a new version, recheck fields and sources, then publish. Past calls keep the version they used and are never overwritten.")
        if any(word in question for word in ("出处", "证据", "原文")):
            lines.append("A source needs at least the document name, version, section position and the closest original sentence. When one section supports several items, mark the evidence as coarse.")
        if any(word in question for word in ("发布", "上架", "流程")):
            lines.append("Publishing order: register source → split and clean → extract fields → human check → grant by role → publish. Unpublished material never reaches the three channels.")
    elif agent_id == "ops-observe":
        counts = {}
        for row in calls:
            counts[row.get("channel") or ""] = counts.get(row.get("channel") or "", 0) + 1
        latest = calls[0] if calls else None
        lines = [
            f"Run monitoring: {metrics.get('calls', 0)} calls in the whole database, {metrics.get('blocked', 0)} blocked, {metrics.get('confirmed', 0)} confirmed-violation notes.",
            f"In the most recent records: sales {counts.get('sales', 0)}, self-service {counts.get('self', 0)}, contact center {counts.get('phone', 0)}.",
            (f"The latest call is from {intl.CHANNELS.get(latest.get('channel'), latest.get('channel') or 'an unrecorded channel')}, status {latest.get('status') or 'not recorded'}." if latest else "There are no service calls yet."),
            "These figures come from records returned by the three channels. The platform itself does not underwrite, quote or pay claims.",
        ]
        if any(word in question for word in ("失败", "异常", "错误")):
            failed = sum(1 for row in calls if row.get("status") == "error")
            lines.append(f"Model errors in recent records: {failed}. On error, rule results and existing evidence are kept; a failure is never presented as a successful answer.")
        if any(word in question for word in ("拦截", "风险", "违规")):
            risky = sum(1 for row in calls if row.get("rule_category"))
            lines.append(f"Recent records with a compliance category: {risky}. A category is only a signal for review; the final disposition is appended by a reviewer.")
    elif agent_id == "ops-sample":
        counts = {}
        for row in calls:
            for part in (row.get("rule_category") or "").split(","):
                if part:
                    counts[part] = counts.get(part, 0) + 1
        lines = ["Review assistance explains categories from retained records and suggests a disposition. Confirm, false positive or knowledge gap must be chosen by a person, and choosing one never changes the original answer."]
        if counts:
            lines.append("Categories recorded: " + ", ".join(f"{RULE_NAMES_EN.get(key, key)} {value}" for key, value in counts.items()))
        else:
            lines.append("No compliance categories are recorded in this batch yet.")
        hits = compliance_rules.find(question)
        if hits:
            lines.append("The text you pasted matches: " + ", ".join(item["name"] for item in hits) + ". If this is the script itself, confirm a violation; if you are only asking how a clause is worded, it is more likely a false positive.")
    elif agent_id == "ops-grant":
        lines = ["Access is set in two steps: first who may call an agent, then which published material the agent may read. Business roles cannot create agents or open full access."]
        for duty in duties:
            names = ", ".join(intl.agent_name(name) for name in duty["agents"])
            lines.append(f"{intl.DUTY_BY_NAME.get(duty['name'], duty['name'])}: {names or 'no preset agents'}")
        lines.append("Knowledge governance, Run monitoring, Review assistance, Access management and Source consistency are for platform operations only; they are never granted to sales, self-service or the contact center.")
        lines.append("Where to edit: Platform operations → Agent access → Existing grants → choose an agent → adjust roles or material → Save. Only platform operations or the legacy maintainer role can do this; trainers cannot change it themselves. This is a suggestion only; nothing is saved.")
        lines.append("A new agent starts with no material. If no material is ticked, it cannot fill gaps with other products.")
    else:
        lines = ["Source consistency: sales, self-service and the contact center all read the same structured fields first, then phrase the answer for their audience. Figures follow the fields and clause positions; the three channels never keep separate versions."]
    text = "\n".join(lines)
    return {"text": text, "evidence": [{"id": agent_id, "title": "Platform run records", "version": "", "kind": "mock", "position": "", "source": "Local call records and structured clauses", "excerpt": text}]}
