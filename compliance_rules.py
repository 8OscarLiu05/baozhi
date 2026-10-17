"""话术合规四类规则。只做词表拦截，方便对照监管文件增补，不代替人工抽检。

英文词只收肯定说法（如 "returns are guaranteed"），避免把 "not guaranteed" 这类否定句误判。
"""
from __future__ import annotations

import intl

RULES = (
    {
        "id": "promise_pay",
        "name": "承诺赔付或承保",
        "note": "不能把演示说成已经赔付、一定能赔或一定能投保。",
        "name_en": "Promising a payout or approval",
        "note_en": "A demo must never be presented as paid, certain to pay or certain to be approved.",
        "words": ("保证赔", "一定赔", "肯定赔", "一定能赔", "一定能投保", "保证承保", "肯定能赔", "保证能赔", "包赔", "必赔", "已经赔付",
                  "will definitely pay", "definitely pays", "definitely be paid", "guaranteed to pay", "guaranteed payout",
                  "guarantee the claim", "guaranteed approval", "guaranteed to be approved", "always pays out",
                  "will surely pay", "certain to pay", "definitely pay"),
    },
    {
        "id": "yield_guarantee",
        "name": "收益保证",
        "note": "红利和演示利率都不是保证利益。",
        "name_en": "Guaranteed returns",
        "note_en": "Dividends and illustrated rates are never guaranteed benefits.",
        "words": ("红利一定有", "红利肯定有", "红利一定", "红利肯定", "稳赚不赔", "稳赚", "保本高收益", "保证收益", "收益保证", "年化保证", "红利有保证",
                  "returns are guaranteed", "return is guaranteed", "dividends are guaranteed", "dividend is guaranteed",
                  "guaranteed high return", "guarantees a return", "risk-free return", "can't lose money", "cannot lose money",
                  "sure profit"),
    },
    {
        "id": "deposit_compare",
        "name": "与存款或理财比较",
        "note": "保险利益不能说成比存款或理财划算。",
        "name_en": "Comparing with deposits or wealth products",
        "note_en": "Insurance benefits must not be framed as better value than deposits or wealth products.",
        "words": ("比存银行划算", "比存银行", "比银行存款", "比理财", "相当于存款", "比余额宝", "比银行理财",
                  "better than a bank deposit", "better than bank deposits", "better than a savings account",
                  "better than savings", "beats a savings account", "beats bank deposits", "same as a deposit",
                  "better than wealth management", "better than putting money in the bank",
                  "better than keeping money in the bank", "better than the bank"),
    },
    {
        "id": "disparage",
        "name": "夸大或贬低",
        "note": "不能说自己全市场最好，也不能贬低其他公司的产品。",
        "name_en": "Exaggeration or disparagement",
        "note_en": "Never claim to be the best on the market or run down other companies' products.",
        "words": ("全市场第一", "最好的产品", "别家都不如", "其他公司不行", "没有比这更好", "别的公司都差",
                  "best product on the market", "number one on the market", "no. 1 on the market", "better than every other",
                  "other insurers are worse", "other companies are bad", "nothing better than this"),
    },
)


def find(content):
    text = content or ""
    low = text.lower()
    english = intl.english()
    found = []
    for rule in RULES:
        words = [word for word in rule["words"] if word in text or (word.isascii() and word in low)]
        if not words:
            continue
        name, note = (rule["name_en"], rule["note_en"]) if english else (rule["name"], rule["note"])
        found.append({"id": rule["id"], "name": name, "note": note, "word": max(words, key=len)})
    return found


def labels(content):
    return [item["word"] for item in find(content)]
