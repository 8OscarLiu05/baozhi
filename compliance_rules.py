"""话术合规四类规则。只做词表拦截，方便对照监管文件增补，不代替人工抽检。"""
from __future__ import annotations

RULES = (
    {
        "id": "promise_pay",
        "name": "承诺赔付或承保",
        "note": "不能把演示说成已经赔付、一定能赔或一定能投保。",
        "words": ("保证赔", "一定赔", "肯定赔", "一定能赔", "一定能投保", "保证承保", "肯定能赔", "保证能赔", "包赔", "必赔", "已经赔付"),
    },
    {
        "id": "yield_guarantee",
        "name": "收益保证",
        "note": "红利和演示利率都不是保证利益。",
        "words": ("红利一定有", "红利肯定有", "红利一定", "红利肯定", "稳赚不赔", "稳赚", "保本高收益", "保证收益", "收益保证", "年化保证", "红利有保证"),
    },
    {
        "id": "deposit_compare",
        "name": "与存款或理财比较",
        "note": "保险利益不能说成比存款或理财划算。",
        "words": ("比存银行划算", "比存银行", "比银行存款", "比理财", "相当于存款", "比余额宝", "比银行理财"),
    },
    {
        "id": "disparage",
        "name": "夸大或贬低",
        "note": "不能说自己全市场最好，也不能贬低其他公司的产品。",
        "words": ("全市场第一", "最好的产品", "别家都不如", "其他公司不行", "没有比这更好", "别的公司都差"),
    },
)


def find(content):
    text = content or ""
    found = []
    for rule in RULES:
        words = [word for word in rule["words"] if word in text]
        if not words:
            continue
        found.append({"id": rule["id"], "name": rule["name"], "note": rule["note"], "word": max(words, key=len)})
    return found


def labels(content):
    return [item["word"] for item in find(content)]
