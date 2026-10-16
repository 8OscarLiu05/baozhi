"""示意保险（虚构）公司库。种子固定为 20261011，同一段代码每次得到同一批编号。

运行 `python company_library.py` 只在终端打印规模，不写数据库，也不调用模型。
"""
from __future__ import annotations

import random

SEED = 20261011
ORG_NAME = "示意保险（虚构）"
ORG_NOTE = "虚构。种子 20261011。不代表真实保险公司，不用于费率和发生率，也不导入外部赔案。"

DUTIES = (
    {"id": "sales", "name": "营销展业", "prefix": "展业", "channel": "sales", "job": "产品问答、话术草稿和陪练。不能下承保结论。"},
    {"id": "service", "name": "客户服务", "prefix": "客服", "channel": "", "job": "查看转人工，并按已发布资料核对条款和流程。"},
    {"id": "outreach", "name": "电话外呼", "prefix": "外呼", "channel": "phone", "job": "只生成话术草稿，页面没有拨号。"},
    {"id": "seat", "name": "电话坐席", "prefix": "坐席", "channel": "phone", "job": "贴入已经写好的转写，旁边给出提示。"},
    {"id": "quality", "name": "通话质检", "prefix": "质检", "channel": "phone", "job": "事后另记一条质检结果，不改写当时的回答。"},
    {"id": "underwrite", "name": "核保作业", "prefix": "核保", "channel": "", "job": "只列出缺项，不给出承保通过或拒保。"},
    {"id": "claim", "name": "理赔作业", "prefix": "理赔", "channel": "", "job": "列出材料和下一步，不支付赔款，也不认定必赔。"},
    {"id": "training", "name": "培训", "prefix": "培训", "channel": "", "job": "用陪练练习，记录不是考核成绩。"},
    {"id": "platform", "name": "平台与知识运营", "prefix": "平台", "channel": "", "job": "新建智能体、绑定已发布资料、查看全量调用。"},
)
DUTY_IDS = tuple(item["id"] for item in DUTIES)
DUTY_NAMES = {item["id"]: item["name"] for item in DUTIES}
LEGACY_ROLES = ("viewer", "builder", "reviewer")
ROLES = LEGACY_ROLES + DUTY_IDS + ("customer",)
LIMITED_ROLES = ("viewer", "customer") + tuple(item["id"] for item in DUTIES if item["id"] != "platform")
CHANNELS = {"sales": "展业", "self": "客户自助", "phone": "电话中心"}
CHANNEL_DUTY = {"sales": "sales", "self": "customer"}
PHONE_DUTIES = ("outreach", "seat", "quality")

# 预置智能体里，每条职责真正可以调用的部分。服务端按这个表拒绝越权。
ALLOWED_AGENTS = {
    "sales": ("advisor", "compare", "outreach", "coach"),
    "service": ("desk", "claimguide"),
    "outreach": ("outreach",),
    "seat": ("advisor", "desk"),
    "quality": ("quality",),
    "underwrite": ("underwrite",),
    "claim": ("claimguide",),
    "training": ("coach",),
    "customer": ("desk", "claimguide"),
    "platform": ("advisor", "compare", "desk", "claimguide", "coach", "outreach", "underwrite", "quality", "ops-knowledge", "ops-observe", "ops-sample", "ops-grant", "ops-voice"),
}
DEFAULT_AGENT = {
    "sales": "advisor",
    "service": "desk",
    "outreach": "outreach",
    "seat": "advisor",
    "quality": "quality",
    "underwrite": "underwrite",
    "claim": "claimguide",
    "training": "coach",
    "customer": "desk",
    "platform": "ops-observe",
}

PRODUCTS = (
    {"id": "card-01", "title": "产品卡片-01", "mark": "虚构句子",
     "sentence": "这张卡片还没有条款句子。它只占一个产品编号，方便三个入口选到同一张卡片。"},
    {"id": "card-02", "title": "产品卡片-02", "mark": "虚构句子",
     "sentence": "这张卡片没有责任、保费或赔付约定。不要把它写成示意公司的在售产品。"},
)
SAMPLE_EXCERPT = "这是种子 20261011 生成的虚构调用，不是模型结论，也不是保险条款。"


def agent_allowed(duty, item):
    if item.get("id") in ALLOWED_AGENTS.get(duty, ()):
        return True
    return duty in (item.get("duties") or [])


def generate(seed=SEED):
    rng = random.Random(seed)
    staff = []
    for duty in DUTIES:
        for number in (1, 2):
            staff.append({"id": f"{duty['prefix']}-{number:02d}", "duty": duty["id"], "duty_name": duty["name"], "fictional": 1})
    customers = [{"id": f"客户-{number:02d}", "fictional": 1} for number in range(1, 41)]
    policies = []
    for number in range(1, 41):
        product = PRODUCTS[rng.randrange(len(PRODUCTS))]
        policies.append({
            "id": f"DEMO-{number:02d}",
            "customer_id": f"客户-{number:02d}",
            "product_id": product["id"],
            "status": "演示保单",
            "fictional": 1,
            "catalog_id": {"DEMO-01": "life-zhongying-xinyue", "DEMO-02": "ci-zhonghong-shuangxing"}.get(f"DEMO-{number:02d}", ""),
        })
    specials = [
        {"channel": "sales", "duty": "sales", "operator_id": "展业-01", "context_id": "客户-01", "policy_id": "DEMO-01",
         "text": "产品卡片-01有没有可以核对的句子？", "status": "error", "handoff": 0},
        {"channel": "self", "duty": "customer", "operator_id": "客户-02", "context_id": "客户-02", "policy_id": "DEMO-02",
         "text": "那是不是一定能赔", "status": "rejected", "handoff": 0},
        {"channel": "self", "duty": "customer", "operator_id": "客户-03", "context_id": "客户-03", "policy_id": "DEMO-03",
         "text": "请把这张演示保单转给客服看一下。", "status": "sample", "handoff": 1},
        {"channel": "phone", "duty": "outreach", "operator_id": "外呼-01", "context_id": "名单-01", "policy_id": "",
         "text": "给名单-01写一段开场白，先说明产品卡片还没有条款。", "status": "sample", "handoff": 0},
        {"channel": "phone", "duty": "seat", "operator_id": "坐席-01", "context_id": "通话-01", "policy_id": "",
         "text": "客户问产品卡片-01能不能赔。请只根据摘录给旁边的提示。", "status": "sample", "handoff": 0},
        {"channel": "phone", "duty": "quality", "operator_id": "质检-01", "context_id": "通话-02", "policy_id": "",
         "text": "事后检查这段转写里有没有把演示说成已经赔付。", "status": "sample", "handoff": 0},
    ]
    fillers = []
    for number in range(7, 21):
        kind = number % 3
        if kind == 0:
            fillers.append({"channel": "sales", "duty": "sales", "operator_id": "展业-02", "context_id": f"客户-{number:02d}",
                            "policy_id": f"DEMO-{number:02d}", "text": "请用已发布资料说明产品卡片的边界，不要报价。", "status": "sample", "handoff": 0})
        elif kind == 1:
            fillers.append({"channel": "self", "duty": "customer", "operator_id": f"客户-{number:02d}", "context_id": f"客户-{number:02d}",
                            "policy_id": f"DEMO-{number:02d}", "text": "我想了解这张演示保单对应的产品卡片写了什么。", "status": "sample", "handoff": 0})
        else:
            fillers.append({"channel": "phone", "duty": "seat", "operator_id": "坐席-02", "context_id": f"通话-{number:02d}",
                            "policy_id": "", "text": "坐席贴入一段转写：客户只问了产品卡片编号，没有提供其他个人信息。", "status": "sample", "handoff": 0})
    rng.shuffle(fillers)
    sessions, calls, handoffs = [], [], []
    for index, item in enumerate(specials + fillers, 1):
        session_id = f"fs{index:010d}"
        call_id = f"fc{index:010d}"
        created = f"2026-10-11T00:00:{index:02d}+00:00"
        sessions.append({**item, "id": session_id, "created": created, "fictional": 1})
        answer = {
            "error": "模型没有返回。这条虚构记录保留摘录，页面不留空白。",
            "rejected": "模型句子里出现承诺用语，未作为结论。请改看摘录或转人工。",
        }.get(item["status"], "虚构样例。没有采用模型生成的句子。")
        calls.append({
            "id": call_id, "session_id": session_id, "created": created, "channel": item["channel"], "duty": item["duty"],
            "operator_id": item["operator_id"], "context_id": item["context_id"], "policy_id": item["policy_id"],
            "agent_id": DEFAULT_AGENT[item["duty"]], "text": item["text"], "status": item["status"], "adopted": 0,
            "answer": answer, "excerpt": SAMPLE_EXCERPT, "handoff": item["handoff"], "fictional": 1, "ms": 0,
            "rule_category": "promise_pay" if item["status"] == "rejected" else "",
        })
        if item["handoff"]:
            handoffs.append({"id": f"fh{index:010d}", "created": created, "call_id": call_id, "customer_id": item["operator_id"],
                             "text": item["text"], "status": "待处理", "fictional": 1})
    return {
        "org": {"id": "org-demo", "name": ORG_NAME, "seed": seed, "note": ORG_NOTE, "fictional": 1},
        "staff": staff,
        "products": [dict(item, fictional=1) for item in PRODUCTS],
        "customers": customers,
        "policies": policies,
        "sessions": sessions,
        "calls": calls,
        "handoffs": handoffs,
    }


def main():
    lib = generate()
    print(f"{lib['org']['name']} · 种子 {lib['org']['seed']}")
    print(f"员工 {len(lib['staff'])} · 客户 {len(lib['customers'])} · 保单 {len(lib['policies'])}")
    print(f"会话 {len(lib['sessions'])} · 调用 {len(lib['calls'])} · 转人工 {len(lib['handoffs'])}")
    print("渠道只含展业、客户自助、电话中心。全部带虚构标记。")


if __name__ == "__main__":
    main()
