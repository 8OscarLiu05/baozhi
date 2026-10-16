"""条款结构对照与信息目录。

只整理本项目已有资料和仍缺的证据，不生成保险公司正式条款，也不编造发生率或价格。
"""
import re

ELEMENTS = {
    "identity": "资料身份",
    "scope": "适用范围",
    "benefit": "保险责任",
    "limit": "限制与除外",
    "boundary": "责任边界",
    "waiting": "期间与等待期",
    "definition": "术语定义",
    "materials": "申请材料",
    "parameter": "研究参数",
    "other": "其他表述",
}
SLOT_STATUS = {
    "stated": "已有表述",
    "coarse": "证据偏粗 · 需拆项核对",
    "research": "只有研究假设",
    "mentioned": "只点到、尚无约定",
    "missing": "尚未写入",
}
CATALOG_STATUS = {
    "ready": "系统已采集",
    "research": "仅研究参数",
    "gap": "证据缺口",
}
DISPOSITIONS = {
    "needs_specialist": "待保险成员确认",
    "return_gap": "退回补充资料",
    "dispute": "存在争议，暂停对外引用",
    "continue_demo": "演示路径可继续",
}
CHECKS = {
    "citation": "情景结论能回到本次固定的原文段落",
    "identity": "草案或虚构身份已标明，没有写成在售产品",
    "no_promise": "没有把研究参数写成保费或赔付承诺",
    "hypertension": "没有把高血压自动认定成可投保或可赔",
    "missing_listed": "缺项、异常和条款缺口已经出现在结果里",
}
GAP_ACTIONS = {"checked_original": "已核对原文", "return_materials": "退回补资料", "insurance_member": "交给保险成员"}
PENDING = ("尚待", "待研究", "未给出", "尚未", "不能据此", "待专业", "未拟定", "未确定", "另核")
RESEARCH_MARKERS = ("非推荐", "仅供设计", "教学", "待研究", "均待研究", "未经专业")
BOARD_NOTICE = "这是住院津贴产品通常要写清的条款结构，用来对照现有资料。它不是某家公司的正式条款，也不能代替保险成员审定。"

SLOTS = [
    {"code": "identity", "title": "资料身份", "keywords": ["不是可销售", "不是在售", "虚构样本", "不是已审定"], "affirm": ["不是可销售", "不是在售", "虚构", "不是已审定"], "expect": "开篇要写明这是研究草案或虚构样本，不能当作在售保险。"},
    {"code": "people", "title": "投保对象、城市与年龄", "keywords": ["外卖骑手", "新市民", "年龄", "城市"], "expect": "正式条款要写清谁可以申请、哪个城市、年龄上下限。当前只确定了研究对象，城市和年龄还没定。"},
    {"code": "benefit", "title": "住院津贴责任", "keywords": ["拟议给付", "定额津贴"], "expect": "要写明什么住院可以讨论给付、按什么日额计算。现在只有拟议方向，没有可用责任约定。"},
    {"code": "waiting", "title": "等待期", "keywords": ["等待期"], "expect": "要写明从哪一天起算，等待期内住院如何处理。材料里只说尚待论证。"},
    {"code": "exclusion", "title": "责任免除", "keywords": ["责任除外", "除外责任", "免责"], "expect": "要逐条列出不给付的情形。现在只提到除外还要研究，没有免除清单。"},
    {"code": "hospital", "title": "医院与住院定义", "keywords": ["医院范围", "医院等级", "必要住院", "术语"], "expect": "要定义什么样的医院、怎样才算一次住院。当前没有可用定义。"},
    {"code": "hypertension", "title": "高血压相关责任", "keywords": ["高血压"], "affirm": ["不能仅凭", "不能由疾病", "不能自动"], "expect": "慢病能否纳入，必须单独写清告知、既往症和责任条件。疾病名称本身不能推出可投保或可赔。"},
    {"code": "amount", "title": "给付金额与天数", "keywords": ["日额", "给付天数", "每日津贴"], "kind": "parameter", "expect": "日额、免给付天数和上限可以先作为研究参数比较，不能写成正式保险金额。"},
    {"code": "materials", "title": "申请材料", "keywords": ["模拟申请", "必交", "申请准备", "材料包括"], "expect": "正式产品要有必交材料清单。当前只是流程演示中的准备提示。"},
    {"code": "channel", "title": "受理渠道与时效", "keywords": ["申请渠道", "索赔时效", "正式指南"], "expect": "要写明向谁申请、多久内提交。真实渠道尚未确定。"},
    {"code": "renewal", "title": "续保与合同延续", "keywords": ["续保", "合同延续"], "expect": "一年以后是否还能继续保障，需要单独约定。现有资料没有这一条。"},
    {"code": "dispute", "title": "争议处理", "keywords": ["争议处理", "仲裁", "诉讼"], "expect": "正式条款通常写明争议如何处理。这里还没有对应表述。"},
    {"code": "boundary", "title": "明确不做的责任", "keywords": ["医疗费用报销", "停工收入", "不覆盖门诊"], "expect": "把医疗费用报销、门诊和出院后停工写在边界里，避免和津贴责任混在一起。"},
]


def _catalog(code, category, name, definition, source, sensitivity, status, gap, owner):
    return {"code": code, "category": category, "name": name, "definition": definition, "source": source, "sensitivity": sensitivity, "status": status, "gap": gap, "owner": owner, "status_label": CATALOG_STATUS[status]}


CATALOG = [
    _catalog("question", "服务受理", "本次问题", "用户想弄清的保障问题。", "智能服务页填写", "普通，不要写真实姓名和联系方式", "ready", "", "中台"),
    _catalog("event", "服务受理", "事件类型", "住院、门诊、交通意外或尚未确认。", "智能服务页填写", "普通", "ready", "门诊和意外只做提示，不套用住院规则。", "中台"),
    _catalog("insured", "服务受理", "是否持有对应保障", "案例里的设定，不是保单查询结果。", "智能服务页填写", "普通", "ready", "没有连接保险公司保单系统。", "中台"),
    _catalog("related", "服务受理", "是否与高血压相关", "案例里的设定，用来提醒不能从病名直接下结论。", "智能服务页填写", "健康相关，仅用于虚拟案例", "ready", "不能代替诊断或核保结论。", "产品"),
    _catalog("admission", "服务受理", "入院日与出院日", "测算页使用的假设日期。", "产品测算页填写", "普通", "ready", "只用于虚拟情景，不是理赔受理。", "中台"),
    _catalog("eligibility", "服务受理", "责任条件是否满足", "未知、假设满足或假设不满足。未知时不计算金额。", "产品测算页填写", "普通", "ready", "假设满足不等于真实责任成立。", "核保"),
    _catalog("occupation", "产品参数", "职业范围", "当前研究对象是外卖骑手。", "研究约定", "普通", "research", "还没有写成可执行的职业定义。", "产品"),
    _catalog("city", "产品参数", "城市", "首期打算只研究一个城市。", "待团队确定", "普通", "gap", "城市尚未选定，不能写成销售区域。", "产品"),
    _catalog("age", "产品参数", "年龄上下限", "打算研究成年骑手，具体上下限未定。", "待团队确定", "普通", "gap", "没有年龄条款。", "产品"),
    _catalog("daily", "产品参数", "每日津贴", "教学用日额，保存在研究方案版本里。", "产品设计页", "研究数字", "research", "没有精算依据，不是保险金额。", "精算"),
    _catalog("waiting", "产品参数", "等待期天数", "教学用天数，和测算口径连在一起。", "产品设计页", "研究数字", "research", "条款还没写明起算日和等待期内如何处理。", "产品"),
    _catalog("caps", "产品参数", "免给付天数与上限", "单次、年度和每次免给付天数。", "产品设计页", "研究数字", "research", "只用于方案比较。", "产品"),
    _catalog("hospital", "条款与核保", "医院等级与必要住院", "判断住院是否符合约定所需的定义。", "待写入条款", "普通", "gap", "现有资料没有可用定义。", "保险成员"),
    _catalog("preexisting", "条款与核保", "既往症与健康告知", "高血压等慢病如何告知、是否纳入。", "待论证", "健康相关", "gap", "不能把研究兴趣写成可保结论。", "核保"),
    _catalog("competitor", "外部证据", "完整比较条款", "用来看市场上已有产品写了什么。", "待保险成员提供", "外部资料", "gap", "尚未放入可逐条核对的完整条款，系统不会编造条款原文。", "保险成员"),
    _catalog("incidence", "外部证据", "住院发生情况", "讨论成本时需要的频率、天数和疾病分层。", "待核保与精算提供", "研究数字", "gap", "没有可引用的统计。教学计算器里的概率只是假设，不能当成发生率。", "精算"),
    _catalog("premium", "外部证据", "正式费率", "可以出售之前的价格依据。", "待精算", "研究数字", "gap", "系统不提供建议保费。", "精算"),
]


def parse_chunk(content):
    match = re.search(r"【([^】]{1,80})】", content or "")
    if not match:
        body = (content or "").strip()
        return "未分条段落", "other", body
    heading = match.group(1).strip()
    body = content[match.end():].strip() or content.strip()
    return heading, classify(heading + body), body


def classify(text):
    rules = [
        (("身份", "虚构", "不是在售", "不是可销售", "不是已审定"), "identity"),
        (("边界", "不报销", "不覆盖", "不拟"), "boundary"),
        (("材料", "申请"), "materials"),
        (("参数", "每日津贴", "日额"), "parameter"),
        (("等待", "口径"), "waiting"),
        (("除外", "免责", "限制"), "limit"),
        (("定义", "术语"), "definition"),
        (("范围", "投保"), "scope"),
        (("给付", "津贴", "责任"), "benefit"),
    ]
    for keys, name in rules:
        if any(key in text for key in keys):
            return name
    return "other"


def _hit(blob, words):
    return any(word in blob for word in words)


def sentences(content):
    """Keep literal source spans including punctuation. Never synthesize a quotation."""
    return [s.strip() for s in re.findall(r"[^。！？\n]+[。！？]?", content or "") if s.strip()]


def best_sentence(content, keywords):
    parts = sentences(content)
    return max(parts, key=lambda s: sum(word in s for word in keywords), default="")


def status_of(slot, clauses):
    # Prefer body matches to heading-only matches; ties keep original source order.
    extra = {"identity": ["身份说明", "虚构的", "不对应真实"], "benefit": ["提供津贴", "生活津贴", "住院津贴"], "exclusion": ["责任免除"],
             "hospital": ["医院", "住院定义"], "materials": ["材料", "住院事实证明"]}
    words = slot["keywords"] + extra.get(slot["code"], [])
    hits = []
    for clause in clauses:
        for sentence in sentences(clause.get("content")):
            body_hits = sum(word in sentence for word in words)
            heading_hit = _hit(clause.get("heading", ""), words)
            if body_hits or heading_hit:
                score = body_hits * 10 + int(heading_hit)
                # For disease responsibility, a list of pending conditions is more relevant
                # than the target population or a generic no-promise disclaimer.
                if slot["code"] == "hypertension" and "责任" in sentence:
                    score += 15
                hits.append((score, clause, sentence))
    if not hits:
        return "missing", None
    _, clause, sentence = max(hits, key=lambda h: (h[0], -len(h[2])))
    selected = {**clause, "excerpt": sentence}
    if slot["code"] == "identity" and _hit(sentence, slot.get("affirm", [])):
        return "stated", selected
    if _hit(sentence, RESEARCH_MARKERS + ("拟", "教学", "假设")):
        return "research", selected
    if _hit(sentence, PENDING + ("尚无", "是否", "能否", "未定", "不能仅凭")):
        return "mentioned", selected
    if slot["code"] == "people" and not ("年龄" in sentence and "城市" in sentence):
        return "mentioned", selected
    return "stated", selected


EXPECTATIONS = {
    "waiting": "仍需逐项核对：起算日、等待期内发生疾病或住院的处理、期满后的适用条件。研究天数不能补齐这些约定。",
    "exclusion": "仍需逐项核对：不给付情形的完整清单、每项适用条件；一句“除外待论证”不是免除清单。",
    "hospital": "仍需逐项核对：医院范围及等级、必要住院定义、一次住院和重复住院的认定。医院名称或范围提示不等于定义完整。",
    "people": "核对申请对象、城市、职业定义和年龄上下限；研究对象描述不等于可申请条件。",
    "benefit": "核对住院触发条件、责任范围和给付方式；拟议津贴方向不等于可用的保险责任。",
    "materials": "核对正式必交材料、补件要求；模拟申请提示不能直接当作必交清单。",
    "channel": "核对受理机构、申请渠道和时效；需取得正式指南。",
    "renewal": "核对是否可续保、条件及合同延续安排。",
    "dispute": "核对争议处理方式及适用约定。",
}


def research_snapshot(design):
    if not design:
        return None
    return {key: design[key] for key in ("version", "created", "parameters")}


def board(document, clauses, design=None):
    slots = []
    counts = {key: 0 for key in SLOT_STATUS}
    for slot in SLOTS:
        status, clause = status_of(slot, clauses)
        slots.append({
            "code": slot["code"],
            "title": slot["title"],
            "status": status,
            "status_label": SLOT_STATUS[status],
            "expect": EXPECTATIONS.get(slot["code"], slot["expect"]),
            "excerpt": clause["excerpt"] if clause else "",
            "heading": clause.get("heading", "") if clause else "",
            "clause_id": clause.get("id", "") if clause else "",
            "chunk_id": clause.get("chunk_id", "") if clause else "",
            "position": clause.get("position") if clause else None,
            "document_id": document.get("id", ""),
            "gap_id": f"{document.get('id', '')}:{slot['code']}",
        })
    for item in slots:
        shared = [s["title"] for s in slots if item["clause_id"] and s["clause_id"] == item["clause_id"]]
        item["shared_count"] = len(shared)
        item["shared_with"] = shared
        item["content_status"] = item["status"]
        item["content_status_label"] = item["status_label"]
        if len(shared) > 1:
            item.update(status="coarse", status_label=SLOT_STATUS["coarse"])
        counts[item["status"]] += 1
    return {
        "product": document.get("product", ""),
        "document": {key: document.get(key, "") for key in ("id", "title", "version", "kind", "status")},
        "slots": slots,
        "counts": counts,
        "notice": BOARD_NOTICE,
        "research": research_snapshot(design) if document.get("product") == "qianxin" else None,
    }


def collect_gaps(docs, design=None):
    rows = []
    for doc in docs:
        result = board(doc, doc.get("clauses") or [], design)
        for slot in result["slots"]:
            if slot["status"] == "stated":
                continue
            rows.append({**slot, "product": doc.get("title", ""), "version": doc.get("version", ""), "research": result["research"]})
    return rows


def normalize_review(note, disposition, checks):
    if not isinstance(note, str) or not note.strip() or len(note) > 2000:
        raise ValueError("复核意见不能为空，且最多2000个字符")
    note = note.strip()
    if not disposition:
        if checks not in (None, {}, ""):
            raise ValueError("未选择处置时，不能提交核对清单")
        return note, "", None
    if disposition not in DISPOSITIONS:
        raise ValueError("复核处置不在允许范围内")
    if not isinstance(checks, dict):
        raise ValueError("请逐项完成复核核对清单")
    normalized = {}
    for key in CHECKS:
        if not isinstance(checks.get(key), bool):
            raise ValueError("核对清单须逐项确认")
        normalized[key] = checks[key]
    if disposition == "continue_demo" and not all(normalized.values()):
        raise ValueError("存在未通过的核对项时，不能标记为演示路径可继续")
    return note, disposition, normalized


def normalize_gap_actions(gaps, actions, disposition):
    if not disposition:
        if actions:
            raise ValueError("请选择处置后再提交缺口核对")
        return []
    if not isinstance(actions, dict):
        raise ValueError("请逐项处理本次条款缺口")
    expected = {gap["gap_id"] for gap in gaps}
    if set(actions) - expected:
        raise ValueError("提交包含不属于本次任务的缺口")
    missing = [g for g in gaps if actions.get(g["gap_id"]) not in GAP_ACTIONS]
    if missing:
        raise ValueError(f"还有{len(missing)}项条款缺口未处理：{missing[0]['title']}")
    if disposition == "continue_demo" and any(v != "checked_original" for v in actions.values()):
        raise ValueError("仍有退回补资料或交给保险成员的缺口，不能标记为演示路径可继续")
    return [{"gap_id": g["gap_id"], "title": g["title"], "product": g["product"],
             "version": g.get("version"), "action": actions[g["gap_id"]],
             "label": GAP_ACTIONS[actions[g["gap_id"]]]} for g in gaps]
