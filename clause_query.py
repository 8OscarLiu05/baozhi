"""先查结构化字段，再把关键词检索留给原文兜底。跨产品对比由程序算，不交给模型报数字。"""
from __future__ import annotations

import json
import re

SYNONYMS = (("取钱", "减保"), ("取现", "减保"), ("生病", "重疾"), ("养老", "年金领取"), ("等多久", "等待期"), ("才开始赔", "等待期"))
YIELD_REPLY = "收益和红利不能在对话里报具体数字。请到展业页打开利益演示，先看前提：分红不保证，演示利率下的数字不是保证利益，实际以公司公布为准。这次不引用演示表里的收益率。"
COMPARE_WORDS = ("哪款", "哪一个", "哪家", "最早", "对比", "比较")


def expand(question):
    text = question or ""
    extra = [target for source, target in SYNONYMS if source in text]
    return text if not extra else text + " " + " ".join(extra)


def is_yield_question(question):
    text = question or ""
    if any(word in text for word in ("领取方式", "怎么领红利", "红利怎么领")) and not any(word in text for word in ("赚", "收益率", "年化", "保本", "比存")):
        return False
    return any(word in text for word in ("赚多少", "能赚", "收益率", "年化", "IRR", "irr", "红利有多少", "每年收益", "保本", "比存银行", "比存款"))


def _ratio(value):
    if isinstance(value, bool) or value is None or value == "":
        return None
    if isinstance(value, (int, float)) and 0 < value <= 1:
        number = f"{value * 100:.2f}".rstrip("0").rstrip(".")
        return number + "%"
    return str(value)


def _days(value, unit="天"):
    if value is None or value == "":
        return None
    return f"{value}{unit}"


def _waiting_fact(info):
    """天数、意外例外和条款位置放在同一条事实里，避免只说出一个没有例外的天数。"""
    days = info.get("等待期天数")
    if days in (None, ""):
        return None
    cite = str(info.get("等待期条款位置") or "产品信息")
    flag = str(info.get("意外是否有等待期") or "")
    exception = ""
    if flag == "否":
        exception = "因意外伤害导致的情形不适用该等待期"
    elif flag == "是":
        exception = "意外伤害同样适用该等待期"
    text = f"{days}天" + (f"。{exception}" if exception else "")
    return {"keys": ("等待期",), "label": "等待期", "text": text, "cite": cite, "exception": exception}


def _add(facts, keys, label, text, cite):
    if not text:
        return
    facts.append({"keys": keys, "label": label, "text": str(text), "cite": cite or "产品信息"})


def facts_for(product):
    info = product["info"]
    facts = []
    _add(facts, ("犹豫期",), "犹豫期", _days(info.get("犹豫期天数")), "产品信息")
    waiting = _waiting_fact(info)
    if waiting:
        facts.append(waiting)
    _add(facts, ("等待期内", "确诊"), "等待期内确诊的处理", info.get("等待期内确诊怎么处理"), waiting["cite"] if waiting else "产品信息")
    _add(facts, ("宽限期", "宽限"), "宽限期", _days(info.get("宽限期天数")), "产品信息")
    _add(facts, ("投保年龄", "几岁能买"), "投保年龄", info.get("投保年龄"), "产品信息")
    _add(facts, ("保险期间",), "保险期间", info.get("保险期间"), "产品信息")
    ratio = _ratio(info.get("保额递增比例"))
    _add(facts, ("递增", "增额", "每年涨"), "保额递增比例", None if ratio is None else f"每年复利增加{ratio}", "产品信息")
    if info.get("递增起始保单年度") not in (None, ""):
        _add(facts, ("递增", "增额"), "递增起始保单年度", f"第{info['递增起始保单年度']}个保单年度起", "产品信息")
    loan = info.get("保单贷款比例")
    loan_text = loan if isinstance(loan, str) else _ratio(loan)
    _add(facts, ("贷款", "借钱", "能借", "保单贷款"), "保单贷款比例", None if not loan_text else (loan_text if isinstance(loan, str) else f"现金价值的{loan_text}"), "产品信息")
    if info.get("减保起始保单年度") not in (None, ""):
        start = info["减保起始保单年度"]
        wording = "合同生效当年就可以申请减保" if start == 0 else f"第{start}个保单年度起可以减保"
        _add(facts, ("减保", "取钱"), "减保起始", f"{wording}（字段值为{start}）", "产品信息")
    cap = _ratio(info.get("减保年度上限比例"))
    _add(facts, ("减保", "最多减", "取钱"), "减保年度上限", None if cap is None else f"每个保单年度不超过{cap}", "产品信息")
    _add(facts, ("病种", "重疾"), "重疾病种数", None if info.get("重疾病种数") is None else f"{info['重疾病种数']}种", "产品信息")
    critical = [duty for duty in product["duties"] if "重大疾病保险金" in duty["name"]]
    if critical:
        gaps = [duty["payload"].get("间隔期天数") for duty in critical if duty["payload"].get("间隔期天数")]
        gap = f"，相邻两次间隔{gaps[0]}天" if gaps else ""
        _add(facts, ("重疾", "几次", "次数", "重大疾病"), "重大疾病给付次数", f"重大疾病保险金给付{len(critical)}次{gap}", critical[0]["cite"])
    for duty in product["duties"]:
        payload = duty["payload"]
        if "转换年金" in duty["name"] or "转换年金" in duty["kind"]:
            _add(facts, ("转年金", "转换年金"), "转换年金", payload.get("赔付说明") or payload.get("行使条件"), duty["cite"])
        if duty["name"] == "养老年金" and payload.get("领取起始年龄") is not None:
            gender = payload.get("适用被保险人性别") or ""
            keys = ("年金", "领取", "养老", "几岁")
            if gender == "女":
                keys = ("年金", "领取", "养老", "女性", "女的", "女生")
            elif gender == "男":
                keys = ("年金", "领取", "养老", "男性", "男的", "男生")
            _add(facts, keys, f"{gender}性养老年金起领年龄" if gender in ("男", "女") else "养老年金起领年龄", f"{payload['领取起始年龄']}周岁", duty["cite"])
        if "身故" in duty["name"]:
            _add(facts, ("身故",), duty["name"], payload.get("赔付说明"), duty["cite"])
        if duty["name"].startswith("首次重大疾病"):
            _add(facts, ("首次", "重疾", "给付条件"), "首次重大疾病保险金", payload.get("赔付说明"), duty["cite"])
    for group in product["exclusions"]:
        _add(facts, ("免除", "免责", "不赔"), f"责任免除（{group['scope']}）", group["body"][:180], group["cite"])
    return facts


def _named(products, question):
    found = []
    for product in products:
        aliases = {"life-zhongying-xinyue": ("鑫悦", "中英"), "annuity-haigang-jincai": ("金彩", "海港", "颐年", "养老年金"), "ci-zhonghong-shuangxing": ("健康双星", "中宏", "重疾"), "medical-picc-2024": ("人保", "住院医疗")}[product["id"]]
        if any(alias in question for alias in aliases):
            found.append(product)
    return found


CLARIFY_REPLY = "请先指明是哪一款产品。当前没有唯一识别到一份已发布条款，不能默认把全部主产品放在一起回答。请在问题里写上产品名，或先选中一张演示保单。"


def select_products(products, question, focus_id=None):
    """只返回已经点名或由保单焦点确定的产品。比较题的范围由 lookup 单独处理。"""
    named = _named(products, question)
    if named:
        return named
    if focus_id:
        focused = [item for item in products if item["id"] == focus_id]
        if focused:
            return focused
    return []


def _match_facts(product, question):
    expanded = expand(question)
    matched = []
    for fact in facts_for(product):
        if any(key in expanded for key in fact["keys"]):
            matched.append(fact)
    if "减保" not in expanded and "取钱" not in question:
        matched = [fact for fact in matched if fact["label"] not in ("减保起始", "减保年度上限")]
    if "等待期内" in question or "确诊" in question:
        matched = [fact for fact in matched if "等待期内" in fact["label"] or "等待期" == fact["label"]] or matched
    return matched[:4]


def _sentence(product, fact):
    return f"{product['name']}的{fact['label']}：{fact['text']}。〔{product['name']} · 条款 {fact['cite']}〕"


def _evidence(product, fact):
    return {"id": f"field-{product['id']}-{fact['label']}", "title": product["name"], "version": "", "kind": "imported", "position": "", "source": product["source_note"], "excerpt": f"{fact['label']}：{fact['text']}。出处：{fact['cite']}。来源文件：{product['source_file']}。"}


def compare_rows(products, question):
    expanded = expand(question)
    if "减保" in expanded and any(word in question for word in ("最早", "哪款", "哪一个", "比较", "对比")):
        rows = []
        for product in products:
            raw = product["info"].get("减保起始保单年度")
            if raw is None or raw == "":
                continue
            rows.append((raw, product))
        if not rows:
            return None
        rows.sort(key=lambda item: item[0])
        earliest = rows[0][1]
        lines = [f"按减保起始保单年度比较，最早的是{earliest['name']}，字段值为{rows[0][0]}。〔{earliest['name']} · 条款 产品信息〕"]
        for raw, product in rows:
            lines.append(f"{product['short']}：减保起始保单年度 {raw}。〔{product['name']} · 条款 产品信息〕")
        return {"sentence": lines[0], "lines": lines, "evidence": [_evidence(product, {"label": "减保起始", "text": f"减保起始保单年度为{raw}", "cite": "产品信息"}) for raw, product in rows]}
    if any(word in question for word in ("转年金", "转换年金")):
        lines = []
        evidence = []
        for product in products:
            duty = next((item for item in product["duties"] if "转换年金" in item["name"]), None)
            if not duty:
                continue
            lines.append(f"{product['name']}写有转换年金权益。〔{product['name']} · 条款 {duty['cite']}〕")
            evidence.append(_evidence(product, {"label": "转换年金", "text": duty["payload"].get("行使条件") or duty["payload"].get("赔付说明") or "写有转换年金权益", "cite": duty["cite"]}))
        if not lines:
            return {"sentence": "当前主产品的结构化样例里，没有看到转换年金权益。", "lines": ["当前主产品的结构化样例里，没有看到转换年金权益。"], "evidence": []}
        return {"sentence": lines[0], "lines": lines, "evidence": evidence}
    return None


def _result(mode, grounded, evidence, yield_question=False, product_ids=None, facts=None, hits=None):
    return {"hits": hits or [], "grounded": grounded, "evidence": evidence, "yield_question": yield_question, "mode": mode, "product_ids": list(product_ids or []), "facts": facts or []}


def lookup(products, question, focus_id=None):
    question = question or ""
    if is_yield_question(question):
        return _result("yield", YIELD_REPLY, [], yield_question=True)
    named = _named(products, question)
    focused = [item for item in products if item["id"] == focus_id] if focus_id else []
    compare = any(word in question for word in COMPARE_WORDS)
    if compare:
        # 明确在问“哪款/比较”时，不把当前保单收成唯一产品。
        scope = named or [item for item in products if item["shelf"] == "主产品"]
        compared = compare_rows(scope, question)
        if compared:
            tail = "上表由结构化字段直接算出。分红不保证。虚构保单引用公开条款，不代表该公司承保。"
            return _result("compare", "\n".join(compared["lines"] + [tail]), compared["evidence"], product_ids=[item["id"] for item in scope])
    if len(named) > 1:
        return _result("clarify", CLARIFY_REPLY, [], product_ids=[item["id"] for item in named])
    chosen = named or focused
    if len(chosen) != 1:
        return _result("clarify", CLARIFY_REPLY, [])
    hits = []
    evidence = []
    facts = []
    for product in chosen:
        for fact in _match_facts(product, question):
            hits.append({"product": product["name"], "sentence": _sentence(product, fact)})
            evidence.append(_evidence(product, fact))
            facts.append({"product_id": product["id"], "label": fact["label"], "text": fact["text"], "cite": fact["cite"], "exception": fact.get("exception") or ""})
    if not hits:
        return _result("none", "", [], product_ids=[item["id"] for item in chosen])
    tail = "以上内容来自公开条款的结构化样例。虚构保单不代表该公司承保，也不能当成赔付结论。"
    return _result("facts", "\n".join([item["sentence"] for item in hits] + [tail]), evidence, product_ids=[item["id"] for item in chosen], facts=facts, hits=hits)


def numbers_supported(reply, evidence_text):
    for sentence in re.split(r"[。！？\n]", reply or ""):
        numbers = re.findall(r"\d+(?:\.\d+)?%?", sentence)
        if any(number not in evidence_text for number in numbers):
            return False
    return True


def load_rows(connection):
    rows = []
    tables = {item[0] for item in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if "products" not in tables:
        return rows
    for row in connection.execute("SELECT * FROM products ORDER BY id"):
        item = dict(row)
        item["info"] = json.loads(item["info_json"])
        item["duties"] = []
        for duty in connection.execute("SELECT * FROM product_duties WHERE product_id=? ORDER BY position", (item["id"],)):
            packed = dict(duty)
            packed["payload"] = json.loads(packed["payload"])
            item["duties"].append(packed)
        item["exclusions"] = [dict(group) for group in connection.execute("SELECT * FROM product_exclusions WHERE product_id=? ORDER BY position", (item["id"],))]
        item["source_note"] = item["source_note"]
        item["source_file"] = item["source_file"]
        rows.append(item)
    return rows


def exam_questions():
    """字段题的标准答案来自结构化样例，供离线核对。换说法的 10 题不出现字段原名。"""
    direct = [
        ("life-zhongying-xinyue", "中英鑫悦未来的犹豫期是多少天？", ("15",)),
        ("life-zhongying-xinyue", "中英鑫悦未来的宽限期是多少天？", ("60",)),
        ("life-zhongying-xinyue", "中英鑫悦未来的保额递增比例是多少？", ("1.75%",)),
        ("life-zhongying-xinyue", "中英鑫悦未来的保单贷款比例是多少？", ("80%",)),
        ("life-zhongying-xinyue", "中英鑫悦未来什么时候能减保，最多减多少？", ("0", "20%")),
        ("life-zhongying-xinyue", "中英鑫悦未来有没有转换年金？", ("转换年金",)),
        ("annuity-haigang-jincai", "海港金彩颐年的犹豫期是多少天？", ("15",)),
        ("annuity-haigang-jincai", "海港金彩颐年女性养老年金从几岁开始领？", ("55",)),
        ("annuity-haigang-jincai", "海港金彩颐年男性养老年金从几岁开始领？", ("60",)),
        ("annuity-haigang-jincai", "海港金彩颐年的减保起始保单年度是多少？", ("5",)),
        ("annuity-haigang-jincai", "海港金彩颐年的保单贷款比例是多少？", ("80%",)),
        ("ci-zhonghong-shuangxing", "中宏健康双星的等待期是多少天？", ("90",)),
        ("ci-zhonghong-shuangxing", "中宏健康双星的犹豫期是多少天？", ("15",)),
        ("ci-zhonghong-shuangxing", "中宏健康双星重大疾病可以给付几次？", ("3",)),
        ("ci-zhonghong-shuangxing", "中宏健康双星重疾间隔期是多少天？", ("180",)),
        ("ci-zhonghong-shuangxing", "中宏健康双星重疾病种数是多少？", ("130",)),
        ("medical-picc-2024", "人保住院医疗的等待期是多少天？", ("30",)),
        ("medical-picc-2024", "人保住院医疗的投保年龄是多少？", ("105",)),
        ("", "哪款减保最早？", ("中英", "0")),
        ("", "哪款有转换年金？", ("中英", "转换年金")),
    ]
    paraphrases = [
        ("life-zhongying-xinyue", "这款什么时候能取钱，一年最多取多少？", ("0", "20%")),
        ("life-zhongying-xinyue", "急用时能借多少？", ("80%",)),
        ("life-zhongying-xinyue", "保额每年涨多少？", ("1.75%",)),
        ("annuity-haigang-jincai", "女的养老从几岁开始领？", ("55",)),
        ("annuity-haigang-jincai", "男的养老从几岁开始领？", ("60",)),
        ("ci-zhonghong-shuangxing", "生病了要等多久才开始赔？", ("90",)),
        ("ci-zhonghong-shuangxing", "等待期内确诊重疾怎么办？", ("退还",)),
        ("ci-zhonghong-shuangxing", "大病一共能赔几次？", ("3",)),
        ("medical-picc-2024", "住院医疗要等多久？", ("30",)),
        ("", "这几款里最早能取钱的是哪一款？", ("中英",)),
    ]
    rows = []
    for index, (product, ask, expect) in enumerate(direct + paraphrases, 1):
        rows.append({"id": f"q{index:02d}", "product": product, "ask": ask, "expect": expect, "paraphrase": index > len(direct)})
    return rows


def grade(reply, expect):
    text = reply or ""
    return all(piece in text for piece in expect)
