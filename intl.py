"""International (English) mode for the console served at /index.html.

The front end sends ``X-Baosu-Lang: en``. Routing still runs on the Chinese keyword tables: an
English question is glossed with the Chinese keywords it names, so the same field lookup, guard
rules and zero-model paths apply. Fixed replies, field templates and model instructions switch
to English. Clause originals, stored records and Chinese document excerpts are not rewritten.
"""
from __future__ import annotations

import re
from contextvars import ContextVar

LANG: ContextVar[str] = ContextVar("baosu_lang", default="zh")


def english():
    return LANG.get() == "en"


def pick(zh, en):
    return en if english() else zh


# --- English question -> Chinese routing keywords -------------------------------------------
GLOSS = (
    # products
    (r"health double star|double star|manulife|zhonghong|shuangxing", "中宏健康双星"),
    (r"xinyue|aviva|zhongying|cofco", "中英鑫悦"),
    (r"jincai|haigang|yinian", "海港金彩颐年"),
    (r"\bpicc\b|hospitali[sz]ation (?:medical|insurance)|hospital medical|inpatient medical", "人保住院医疗"),
    (r"pension annuit|retirement annuit", "养老年金"),
    # clause facts
    (r"free[- ]look|cooling[- ]off|cancel(?:lation)? period|hesitation period", "犹豫期"),
    (r"(?:during|within|in) the waiting period|before the waiting period ends", "等待期内"),
    (r"waiting period|how long (?:do|does|must|should|will) .*wait|wait before", "等待期"),
    (r"\bdiagnos", "确诊"),
    (r"grace period|late premium|miss(?:ed)? (?:a )?premium", "宽限期"),
    (r"issue age|entry age|eligible age|age limit|how old|age range|who can buy|minimum age|maximum age", "投保年龄"),
    (r"coverage period|policy term|term of (?:the )?(?:policy|coverage|cover)|how long (?:is|does) .*(?:cover|coverage|last)|insurance period", "保险期间"),
    (r"sum insured (?:increase|grow)|increas|grow(?:s|th)? each year|escalat", "递增"),
    (r"policy loan|\bloan|borrow", "贷款"),
    (r"partial surrender|withdraw|take (?:money|cash) out|reduce (?:the )?(?:sum insured|cover)", "减保"),
    (r"how many (?:conditions|illnesses|diseases)|number of (?:conditions|illnesses|diseases)|covered (?:conditions|illnesses)", "病种"),
    (r"how many times|number of (?:payments|claims|times)|multiple (?:payments|claims)|paid more than once", "几次"),
    (r"critical illness|serious illness|major illness", "重疾"),
    (r"first critical illness|first diagnosis", "首次"),
    (r"death benefit|\bdeath\b|\bdies?\b|passes away", "身故"),
    (r"convert(?:ed|ing|sion)? (?:in)?to (?:an )?annuit|annuity conversion|conversion right", "转换年金"),
    (r"annuit|pension|start (?:receiving|collecting|getting)|payout age|retire", "年金 领取"),
    (r"\b(?:female|women|woman)\b", "女性"),
    (r"\b(?:male|men|man)\b", "男性"),
    (r"exclusion|excluded|not covered|won'?t pay|will not pay|doesn'?t pay|does not pay", "免除"),
    (r"\bclaim", "理赔 赔"),
    (r"\bpay(?:s|ing)? out\b|\bpayouts?\b|definitely pay", "赔付"),
    # comparison and returns
    (r"which (?:product|one|plan|policy)|\bearliest\b|\bcompar", "哪款 最早 比较"),
    (r"how much (?:can|will|would) (?:i|it|we) (?:earn|make|get back)|rate of return|return rate|annuali[sz]ed|\birr\b|how much (?:are )?(?:the )?dividends?|guaranteed principal|better than (?:a |the )?(?:bank|savings|deposit)|better than (?:putting|keeping) (?:your |my )?money in (?:a |the )?bank", "收益率"),
    (r"dividend", "红利"),
    # relevance and roles
    (r"insurance|insurer", "保险"),
    (r"\bpolic(?:y|ies)\b", "保单"),
    (r"\bclauses?\b", "条款"),
    (r"premium", "保费"),
    (r"coverage|benefit|\bcover\b", "保障"),
    (r"underwrit", "核保"),
    (r"\bsurrender", "退保"),
    (r"how (?:should|do|can) i (?:say|explain|phrase|talk|respond|answer)|how to (?:say|explain|phrase|talk|respond)|what (?:can|should) i (?:say|not say|avoid)|what not to say|what to avoid", "怎么说 哪些可以 注意什么"),
    (r"how (?:should|do|can) i (?:handle|deal|prepare)|how to (?:handle|deal|prepare)|best practice|principles?|\btips?\b|general (?:process|procedure|workflow)", "怎么做 注意什么 一般流程"),
    (r"training|role[- ]play|coach", "培训 陪练"),
    (r"\bscripts?\b|talk track|wording", "话术"),
    (r"diabet", "糖尿病"),
    (r"hypertension|high blood pressure", "高血压"),
    (r"health (?:disclosure|declaration|question)|disclos|declare", "告知 健康"),
    (r"\bhealth\b", "健康"),
    (r"\bcustomers?\b|\bclients?\b", "客户"),
    (r"documents? (?:needed|required)|what (?:documents|materials|paperwork)|materials?\b|paperwork", "材料"),
    (r"quality (?:check|review|assurance)|\bqa\b", "质检"),
    (r"outbound|cold call", "外呼"),
    (r"hospital", "住院"),
    (r"outpatient", "门诊"),
    (r"accident", "意外"),
    (r"illness|disease|sick", "疾病"),
    # platform operations
    (r"\bcalls?\b|request log|traffic", "调用"),
    (r"fail|error|exception|outage|went wrong", "失败 异常 错误"),
    (r"block|risk|violation|non-?complian", "拦截 风险 违规"),
    (r"update|version|new edition", "更新 版本"),
    (r"source|evidence|citation|original text", "出处 证据 原文"),
    (r"publish|release|go live|workflow|process", "发布 流程"),
    (r"permission|access|grant|authori[sz]", "权限 授权"),
    (r"knowledge", "知识 资料"),
    (r"sampl|spot[- ]check|audit", "抽检"),
    (r"\bagents?\b", "智能体"),
    (r"leave|vacation|reimburs|expense|seal|stamp|meeting|account|password|laptop|helpdesk", "制度 报销 办公"),
    # clearly off-topic
    (r"weather", "天气"),
    (r"\bpoem|poetry", "写首诗"),
    (r"recipe|\bcook", "菜谱"),
    (r"\bjoke", "讲笑话"),
    (r"football|soccer|basketball score", "足球比分"),
    (r"travel guide|itinerary|tourist", "旅游攻略"),
    (r"write (?:some )?code|coding|program in", "写代码"),
    (r"\bmovie|\bfilm\b", "推荐电影"),
    (r"fortune[- ]telling|horoscope", "算命"),
    (r"stock (?:ticker|code|tip)", "股票代码"),
)
_GLOSS = tuple((re.compile(pattern, re.I), words) for pattern, words in GLOSS)


def route_text(text):
    """English questions keep their wording and gain the Chinese keywords the router reads."""
    text = text or ""
    if not english() or not re.search(r"[A-Za-z]{2,}", text):
        return text
    found = []
    for pattern, words in _GLOSS:
        if pattern.search(text) and words not in found:
            found.append(words)
    return text if not found else text + " " + " ".join(found)


def search_text(text):
    """Keyword search over Chinese excerpts: drop English words so "is" or "the" cannot score."""
    return re.sub(r"[A-Za-z]+", " ", text or "") if english() else text


# --- Product names and field templates -------------------------------------------------------
PRODUCTS = {
    "ci-zhonghong-shuangxing": ("Manulife-Sinochem Health Double Star Guardian Critical Illness Insurance", "Health Double Star"),
    "life-zhongying-xinyue": ("Aviva-COFCO Xinyue Future No. 5 (Premium) Whole Life Insurance (Participating)", "Xinyue Future No. 5"),
    "annuity-haigang-jincai": ("Haigang Life Jincai Yinian Pension Annuity Insurance (Participating)", "Jincai Yinian Annuity"),
    "medical-picc-2024": ("PICC Hospitalization Medical Insurance (2024, Online)", "PICC Hospital Medical 2024"),
}


def product_name(product):
    return PRODUCTS.get(product.get("id"), (product.get("name"), product.get("short") or product.get("name")))[0]


def product_short(product):
    return PRODUCTS.get(product.get("id"), (product.get("name"), product.get("short") or product.get("name")))[1]


SOURCE_NOTE = ("Structured sample of a public clause, prepared for coursework. The real insurer and product names are kept; "
               "it is not a product of Example Insurance and cannot be used to underwrite or pay claims.")

LABELS = {
    "犹豫期": "Free-look period",
    "等待期": "Waiting period",
    "等待期内确诊的处理": "Diagnosis during the waiting period",
    "宽限期": "Grace period",
    "投保年龄": "Issue age",
    "保险期间": "Coverage period",
    "保额递增比例": "Annual sum insured increase",
    "递增起始保单年度": "Increase starts",
    "保单贷款比例": "Policy loan limit",
    "减保起始": "Partial surrender start",
    "减保年度上限": "Partial surrender annual limit",
    "重疾病种数": "Covered critical illnesses",
    "重大疾病给付次数": "Critical illness payments",
    "转换年金": "Annuity conversion",
    "女性养老年金起领年龄": "Pension annuity start age (female)",
    "男性养老年金起领年龄": "Pension annuity start age (male)",
    "养老年金起领年龄": "Pension annuity start age",
    "身故保险金": "Death benefit",
    "身故或全残保险金": "Death or total disability benefit",
    "重大自然灾害意外身故保险金": "Major natural disaster accidental death benefit",
    "航空公共交通工具意外身故保险金": "Air travel accidental death benefit",
    "交清增额保险对应的身故保险金": "Death benefit on paid-up additions",
    "首次重大疾病保险金": "First critical illness benefit",
}
EXCLUSION_SCOPES = {
    "身故保险金": "death benefit",
    "疾病类保险金": "illness benefits",
    "身故全残保险金": "death and total disability benefit",
    "全部保险责任": "all benefits",
    "身故保险金、重大自然灾害意外身故保险金、航空公共交通工具意外身故保险金": "death, natural disaster and air travel accidental death benefits",
}


def label(zh):
    if zh in LABELS:
        return LABELS[zh]
    m = re.fullmatch(r"责任免除（(.+)）", zh)
    if m:
        return f"Exclusions ({EXCLUSION_SCOPES.get(m.group(1), m.group(1))})"
    return zh


def cite(value):
    value = str(value or "")
    return "Product information" if value in ("产品信息", "") else f"Clause {value}"


# Team translations of the free-text clause fields. Matched by prefix; the Chinese clause prevails.
FACT_TEXT = (
    ("0周岁（须出生满30日）至80周岁", "From age 0 (at least 30 days old) to age 80"),
    ("0周岁（须出生满30日）至70周岁", "From age 0 (at least 30 days old) to age 70"),
    ("0周岁（须出生满7日）-60周岁", "From age 0 (at least 7 days old) to age 60"),
    ("0-105周岁（0周岁需出生满28日）", "Ages 0 to 105 (at age 0, at least 28 days old)"),
    ("自合同生效日零时起，至被保险人年满105周岁后的首个保单周年日零时止",
     "From 00:00 on the effective date until 00:00 on the first policy anniversary after the insured reaches age 105"),
    ("被保险人终身，自合同生效时起至被保险人身故时止", "The insured's whole life, from the effective date until the insured's death"),
    ("终身", "Whole life"),
    ("合同生效当年就可以申请减保（字段值为0）", "Partial surrender can be requested from the first policy year (field value 0)"),
    ("「所交保险费」为释义11.8定义的专门概念",
     "\"Premiums paid\" is a defined term (Definition 11.8) and is not the same as the total actually paid. Before the payment "
     "period ends, it is the annual premium set by the basic sum insured at the time of the event × the number of policy years; "
     "after the payment period ends, it is that annual premium × the number of payment years. After a partial surrender, or if "
     "the event occurs in the grace period, this figure differs from the cumulative payments in bank records. For a minor "
     "insured, total death benefits are capped by the limit set by the State Council's insurance regulator (2.2). This is the "
     "only benefit of this product that is subject to the exclusions."),
    ("一、因下列情形之一导致被保险人身故的，我们不承担给付身故保险金的责任",
     "1. We do not pay the death benefit if the insured's death is caused by any of the following: (1) intentional killing or "
     "injury of the insured by the policyholder; (2) the insured's intentional crime, or resistance to lawful criminal "
     "enforcement measures; (3) the insured's suicide within 2 years of the contract being concluded or reinstated, unless the "
     "insured had no civil capacity at the time; (4) the insured taking, inhaling or injecting drugs (Definition 11.9); "
     "(5) the insured driving under the influence of alcohol (Definition 11 …"),
    ("确诊重疾的，不赔重疾金",
     "If a critical illness is diagnosed, the critical illness benefit, specified-disease extra benefit, critical illness care "
     "benefit and leukaemia care benefit are not paid; total premiums paid are refunded and the contract ends. If a moderate "
     "illness, mild illness or specified tumour is diagnosed, the corresponding benefit is not paid and the contract stays in force"),
    ("按确诊时基本保额给付",
     "Paid at the basic sum insured at the time of diagnosis, and all premiums due from the first premium due date after "
     "diagnosis are waived. After payment, the contract's cash value drops to zero from the date of diagnosis"),
    ("仅在未给付过首次重疾金的情形下给付",
     "Paid only if the first critical illness benefit has not been paid, in three bands: before age 18, the greater of the cash "
     "value and total premiums paid; from age 18 until the first policy anniversary after age 65, the greatest of basic sum "
     "insured × factor k, the cash value and total premiums paid (k = 100% without the critical illness care benefit, 150% with "
     "it); after that, the greatest of the basic sum insured, the cash value and total premiums paid"),
    ("因下列情形之一，导致被保险人发生疾病",
     "If the insured's illness, illness condition or surgery is caused by any of the following, we do not pay the critical "
     "illness, moderate illness, mild illness, specified-disease extra, specified tumour removal, terminal illness, critical "
     "illness care or leukaemia care benefits (the last for the minors' plan only): (1) intentional killing or injury of the "
     "insured by the policyholder; (2) the insured's intentional self-injury, intentional crime or resistance to lawful …"),
    ("因下列情形之一，导致被保险人身故或全残的",
     "We do not pay the death or total disability benefit if the insured's death or total disability is caused by any of the "
     "following: (1) intentional killing or injury of the insured by the policyholder; (2) the insured's intentional crime or "
     "resistance to lawful criminal enforcement measures; (3) the insured's suicide within two years of the contract being "
     "concluded or last reinstated, unless the insured had no civil capacity at the time; (4) war, military conflict, riot or "
     "armed rebellion; (5) …"),
    ("同一条责任分三种情形，比较项数量不同",
     "One benefit with three cases, each comparing a different number of amounts. 1. Death before age 18 (not including the 18th "
     "birthday): the greater of the cash value and premiums paid. 2. Death at or after age 18 and on or before the first policy "
     "anniversary after the payment period ends: the greater of the cash value and premiums paid × age factor. 3. Death after "
     "age 18 and after that anniversary: the greatest of the current-year sum insured, the cash value and premiums paid × age "
     "factor. The age factor depends on age at death: 160% for ages 18-41, 140% for 42-61 and 120% for 62 and over. The "
     "current-year sum insured follows Clause 1.6: in the first policy year it equals the basic sum insured, and on each later "
     "policy anniversary it grows by 1.75% a year, compounded on the previous year-end amount. The basic sum insured here "
     "excludes benefits from dividend distribution (last sentence of 2.1) and the accumulated paid-up additional sum insured "
     "(end of 3.2). For a minor insured, total death benefits are capped by the limit set by the State Council's insurance "
     "regulator (1.7)."),
    ("在身故保险金之外额外给付，给付后合同终止。触发条件为因条款约定的8种重大自然灾害",
     "Paid in addition to the death benefit; the contract ends after payment. It applies when the insured suffers an accidental "
     "injury in one of the 8 major natural disasters listed in the clause (15.6: earthquake, debris flow, landslide, flood, "
     "tsunami, typhoon, hail, tornado) and dies within 180 days (inclusive) with the accident as the direct and sole cause, "
     "before age 76 (not including the 76th birthday). RMB 6 million (600万元) is the cumulative cap per insured; several "
     "policies of this product do not add up. The basic sum insured here excludes benefits from dividend distribution (last "
     "sentence of 2.1)."),
    ("在身故保险金之外额外给付，给付后合同终止。结构与重大自然灾害意外身故保险金相同",
     "Paid in addition to the death benefit; the contract ends after payment. It works like the major natural disaster "
     "accidental death benefit, with a different trigger and cap: the insured has a traffic accident while travelling (15.8) on "
     "public air transport (15.9: a commercial flight licensed to carry fare-paying passengers) and dies within 180 days "
     "(inclusive) with the accident as the direct and sole cause, before age 76. RMB 10 million (1000万元) is the cumulative cap "
     "per insured. The basic sum insured here excludes benefits from dividend distribution (last sentence of 2.1)."),
    ("本责任出现在红利章而非保险责任章",
     "This benefit sits in the dividend chapter, not the benefits chapter, and exists only when dividends are taken as paid-up "
     "additions. Two cases: 1. Death before age 18, or at or after 18 on or before the first policy anniversary after the "
     "payment period ends: the cash value of the paid-up additions is paid, with no comparison. 2. Death after 18 and after "
     "that anniversary: the greater of the cash value of the paid-up additions and the accumulated paid-up additional sum "
     "insured × factor, where the factor is (1+1.75%) to the power of (n-1), n is the policy year at death, and the factor is 1 "
     "in the first policy year. The 160%/140%/120% age factors of the main death benefit do not apply. Exclusion 2.2 lists "
     "the three benefits it covers and does not name this one; the clause is silent, so the field \"subject to exclusions\" is "
     "recorded as null rather than assumed. If the main basic sum insured is reduced, the accumulated paid-up additional sum "
     "insured is reduced in proportion."),
    ("不是保险金给付，是把现金价值的全部或部分作为一次性交清保险费",
     "Not a benefit payment: it is the right to use all or part of the cash value as a single premium to buy an annuity the "
     "company offers at that time. The amount converted must not be below the company's minimum at the time. Annuity amounts "
     "and payment options follow the annuity product offered at conversion; this clause does not state them and they must "
     "not be assumed. After conversion, the converted part no longer provides cover or receives dividends, and the basic and "
     "current-year sums insured are reduced by the ratio of cash value after to before conversion."),
    ("因下列情形之一导致被保险人身故的，我们不承担给付身故保险金、重大自然灾害意外身故保险金",
     "We do not pay the death benefit, the major natural disaster accidental death benefit or the air travel accidental death "
     "benefit if the insured's death is caused by any of the following: 1. intentional killing or injury of the insured by the "
     "policyholder; 2. the insured's intentional crime or resistance to lawful criminal enforcement measures; 3. the insured's "
     "suicide within 2 years of the contract being concluded or reinstated, unless the insured had no civil capacity at the "
     "time; 4. the insured taking, inhaling or injecting drugs …"),
    ("因下列情形之一导致被保险人支出医疗费用的",
     "The insurer pays no benefit for medical expenses caused by, or listed as, the following, or for a critical illness as "
     "defined in this contract: (1) costs from the insured's pre-existing conditions and diseases specifically excluded in the "
     "policy; illnesses the insured had before applying that were not cured at application, unless the insurer knew of them "
     "and accepted them in writing. (2) Injury or illness from an intentional crime, resistance to lawful criminal enforcement "
     "measures, or lawful detention or imprisonment; self- …"),
)
PATTERNS = (
    (r"(\d+)天。因意外伤害导致的情形不适用该等待期", lambda m: f"{m[1]} days. The waiting period does not apply to accidental injury"),
    (r"(\d+)天。意外伤害同样适用该等待期", lambda m: f"{m[1]} days. The waiting period also applies to accidental injury"),
    (r"(\d+)天", lambda m: f"{m[1]} days"),
    (r"(\d+)年", lambda m: f"{m[1]} year" + ("" if m[1] == "1" else "s")),
    (r"(\d+)周岁", lambda m: f"Age {m[1]}"),
    (r"(\d+)种", lambda m: f"{m[1]} conditions"),
    (r"现金价值的([\d.]+%)", lambda m: f"{m[1]} of the cash value"),
    (r"每年复利增加([\d.]+%)", lambda m: f"Increases by {m[1]} a year, compounded"),
    (r"第(\d+)个保单年度起", lambda m: f"From policy year {m[1]}"),
    (r"第(\d+)个保单年度起可以减保（字段值为(\d+)）", lambda m: f"Partial surrender is available from policy year {m[1]} (field value {m[2]})"),
    (r"每个保单年度不超过([\d.]+%)", lambda m: f"No more than {m[1]} in any policy year"),
    (r"重大疾病保险金给付(\d+)次，相邻两次间隔(\d+)天", lambda m: f"The critical illness benefit is payable up to {m[1]} times, with {m[2]} days between consecutive payments"),
    (r"重大疾病保险金给付(\d+)次", lambda m: f"The critical illness benefit is payable up to {m[1]} times"),
)
UNTRANSLATED = " (Chinese clause wording, not yet translated)"


def fact_text(zh):
    zh = str(zh or "")
    for pattern, render in PATTERNS:
        m = re.fullmatch(pattern, zh)
        if m:
            return render(m)
    for prefix, en in FACT_TEXT:
        if zh.startswith(prefix):
            return en
    return zh + UNTRANSLATED


# --- Model instructions ----------------------------------------------------------------------
PROMPT_SUFFIX = (
    " OUTPUT LANGUAGE: The person is using the English console. Write the whole answer in clear, plain English that an "
    "international insurance professional or customer can follow, even though these instructions, the evidence and the "
    "clause excerpts are in Chinese. Translate faithfully; do not add facts, figures or conclusions that are not in the "
    "evidence. Write citations as [Product · Clause X] and use English product names when the evidence gives them. Where a "
    "fixed sentence is quoted above in Chinese, give its English meaning instead. Keep the answer under 160 words."
)

# --- Names used inside English replies --------------------------------------------------------
DUTIES = {"sales": "Sales", "service": "Customer service", "outreach": "Outreach", "seat": "Service desk",
          "quality": "Quality review", "underwrite": "Underwriting assistance", "claim": "Claims assistance",
          "training": "Training", "platform": "Platform operations"}
DUTY_BY_NAME = {"营销展业": "Sales", "客户服务": "Customer service", "电话外呼": "Outreach", "电话坐席": "Service desk",
                "通话质检": "Quality review", "核保作业": "Underwriting assistance", "理赔作业": "Claims assistance",
                "培训": "Training", "平台与知识运营": "Platform operations"}
AGENTS = {"保障需求顾问": "Product assistant", "产品对照助手": "Product comparison assistant", "条款客服": "Clause assistant",
          "理赔引导": "Claims guide", "培训陪练": "Training coach", "外呼话术助手": "Outbound script assistant",
          "核保辅助": "Underwriting assistant", "会话质检": "Conversation QA", "知识治理": "Knowledge governance",
          "运行观测": "Run monitoring", "抽检研判": "Review assistance", "授权编排": "Access management",
          "口径中枢": "Source consistency", "人事制度助手": "HR policy assistant", "行政办事指引": "Admin guide",
          "IT 报障与账号": "IT help & accounts"}
CHANNELS = {"sales": "Sales", "self": "Self-service", "phone": "Contact center"}


def agent_name(name):
    return AGENTS.get(name, name)


def calls_filter():
    """SQL fragment that keeps the international build to calls asked in English."""
    return " AND json_valid(trace_json) AND json_extract(trace_json, '$.lang') = 'en'" if english() else ""


# --- Error messages returned by the API ---------------------------------------------------------
FAULT_LABELS = {
    "产品标识": "Product ID", "资料标题": "Document title", "来源类型": "Source type", "出处": "Source", "正文": "Body text",
    "情景": "Scenario", "结果类型": "Outcome type", "规则说明": "Rule note", "依据段落": "Evidence paragraph",
    "复核说明": "Review note", "职责": "Role", "名称": "Name", "边界": "Boundary", "使用对象": "Audience", "问题": "Question",
    "渠道": "Channel", "操作者编号": "Operator ID", "上下文编号": "Context ID", "保单编号": "Policy ID", "文本": "Text",
    "调用编号": "Call ID", "处置": "Disposition", "处置说明": "Disposition note", "流程": "Flow", "事件": "Event",
    "持有保障情况": "Coverage status", "疾病相关情况": "Illness relation", "演示角色": "Demo role", "文件名": "File name",
}
FAULTS = {
    "JSON格式不正确": "The request is not valid JSON.",
    "Word正文解压后过大": "The Word document is too large after extraction.",
    "上下文要使用虚构公司库里的客户编号": "The context must be a customer ID from the fictional company library.",
    "中台内部智能体只能供平台使用": "Platform agents are for platform operations only.",
    "产品标识只允许小写字母、数字和短横线": "Product IDs may only use lowercase letters, digits and hyphens.",
    "仅支持本机访问": "Only local access is supported.",
    "依据必须属于当前版本的原文段落": "Evidence must be a source paragraph of the current version.",
    "保单编号要以 DEMO- 开头": "Policy IDs must start with DEMO-.",
    "写入请求须使用JSON": "Write requests must use JSON.",
    "利益演示只提供年龄 0、30、45 和交费 1 年、10 年": "The benefit walkthrough only covers ages 0, 30 and 45 with 1-year or 10-year payment.",
    "只支持UTF-8 TXT、Markdown、DOCX和文字型PDF": "Only UTF-8 TXT, Markdown, DOCX and text-based PDF are supported.",
    "只有客户自助可以登记转人工": "Only Self-service can request a human handoff.",
    "只有平台与知识运营可以做抽检处置": "Only Platform operations can handle review samples.",
    "只有平台与知识运营可以查看全量调用": "Only Platform operations can view all calls.",
    "只能把客户自助的这次提问转给客户服务": "Only this Self-service question can be handed to Customer service.",
    "只能授权已发布资料": "Only published material can be granted.",
    "咨询方式无效": "Invalid consultation mode.",
    "外呼要带名单编号，坐席和质检要带通话编号": "Outreach needs a list ID; the service desk and QA need a call ID.",
    "客户自助只能从渠道入口提问": "Self-service can only ask through its channel entry.",
    "客户自助的操作者和上下文都要使用虚构客户编号": "In Self-service, both operator and context must be fictional customer IDs.",
    "对话编号无效": "Invalid conversation ID.",
    "工具不在该助手的许可范围内": "This tool is outside the assistant's permissions.",
    "已发布版本不可修改，请创建新版本": "A published version cannot be changed. Create a new version.",
    "当前演示职责不能从这个入口提交": "The current demo role cannot submit from this entry.",
    "当前演示角色没有此操作权限": "The current demo role is not allowed to do this.",
    "当前职责不能修改授权": "The current role cannot change access.",
    "当前职责不能查看转人工记录": "The current role cannot view handoff records.",
    "当前职责不能调用这个智能体": "The current role cannot use this agent.",
    "当前职责只能查看已发布演示资料": "The current role can only view published demo material.",
    "待审核资料不能进入服务流程": "Material awaiting review cannot enter the service flow.",
    "抽检处置不应改写原回答": "A review disposition must not rewrite the original answer.",
    "授权职责不在九条职责或客户自助范围内": "The granted role is not one of the nine roles or Self-service.",
    "授权范围无效": "Invalid access scope.",
    "接口不存在": "Endpoint not found.",
    "页面或接口不存在": "Page or endpoint not found.",
    "操作者编号和当前职责对不上": "The operator ID does not match the current role.",
    "文件不能超过8MB": "Files must be 8 MB or smaller.",
    "文件编码无效": "Invalid file encoding.",
    "文件解析失败，请检查是否损坏、加密或使用了不支持的格式": "The file could not be parsed. Check whether it is damaged, encrypted or in an unsupported format.",
    "方案版本已变化，请刷新后重试": "The plan version has changed. Refresh and try again.",
    "服务使用者不能调用工作人员智能体": "Customers cannot use staff agents.",
    "未提取到足够文字；扫描件需要先做OCR": "Not enough text was extracted; scanned files need OCR first.",
    "本地演示会话已过期，请刷新页面": "The local demo session has expired. Please refresh the page.",
    "本机会话过多，请重启服务": "Too many local sessions. Please restart the service.",
    "本机最多新建12个对话智能体": "At most 12 custom agents can be created locally.",
    "正文为空或超过18万字符，请拆分后导入": "The text is empty or longer than 180,000 characters. Split it before importing.",
    "此咨询入口只供展业和客户自助使用": "This consultation entry is for Sales and Self-service only.",
    "此版本已发布": "This version is already published.",
    "没有这个智能体": "Agent not found.",
    "没有这张利益演示表": "Benefit walkthrough table not found.",
    "没有这条调用": "Call not found.",
    "渠道不在展业、客户自助、电话中心范围内": "The channel must be Sales, Self-service or Contact center.",
    "渠道和职责对不上": "The channel does not match the role.",
    "电话中心只能由外呼、坐席或质检使用": "The contact center is for Outreach, Service desk or QA only.",
    "请完整填写数值假设": "Please fill in all numeric assumptions.",
    "请求应为JSON对象": "The request must be a JSON object.",
    "请求过大或为空": "The request is too large or empty.",
    "请求长度无效": "Invalid request length.",
    "请至少选择一份资料": "Select at least one document.",
    "请选择最多6份不同的资料": "Select up to 6 different documents.",
    "调用编号过长": "The call ID is too long.",
    "资料不存在": "Document not found.",
    "资料与职责必须是列表": "Documents and roles must be lists.",
    "资料范围包含不存在的产品": "The document scope includes a product that does not exist.",
    "资料范围无效": "Invalid document scope.",
    "跨站请求已拒绝": "Cross-site request rejected.",
    "运行记录不存在": "Run record not found.",
    "这个入口不能调用该智能体": "This entry cannot use that agent.",
    "这张演示保单不属于当前客户": "This demo policy does not belong to the current customer.",
    "这条已经处置过，原回答保持不变": "This item has already been handled; the original answer is unchanged.",
    "这条已经转过人工": "This item has already been handed to a human.",
    "这段对话已经由另一位智能体负责": "This conversation is already handled by another agent.",
    "配置不存在": "Configuration not found.",
    "配置已被其他操作更新，请刷新后重试": "The configuration was updated elsewhere. Refresh and try again.",
    "服务异常，请查看本机测试与配置": "Service error. Check the local tests and configuration.",
    "操作失败，未生成有效结果。请检查输入或查看测试日志。": "The operation failed and produced no valid result. Check the input or the test log.",
}


def fault(message):
    if not english():
        return message
    if message in FAULTS:
        return FAULTS[message]
    m = re.fullmatch(r"(.+?)不能为空，且最多(\d+)个字符", message)
    if m:
        return f"{FAULT_LABELS.get(m[1], m[1])} is required and must be at most {m[2]} characters."
    m = re.fullmatch(r"(.+?)不在允许范围内", message)
    if m:
        return f"{FAULT_LABELS.get(m[1], m[1])} is not an allowed value."
    m = re.fullmatch(r"(.+?)超出允许范围", message)
    if m:
        return f"{m[1]} is out of range."
    return message
