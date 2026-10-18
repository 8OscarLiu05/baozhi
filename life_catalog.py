"""把演示资料中的四份结构化条款读成产品、责任和免除。不改写公司名，也不编保费。"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CLAUSE_DIR = ROOT / "演示资料" / "条款提取"
SOURCE_NOTE = "整理的公开条款结构化样例。保留真实公司名和产品名，不是示意保险的在售产品，也不能据此承保或赔付。"

SPECS = (
    {"id": "life-zhongying-xinyue", "file": "增额寿险/样例_中英鑫悦未来5号至臻版.json", "category": "增额终身寿", "shelf": "主产品", "short": "中英鑫悦未来"},
    {"id": "annuity-haigang-jincai", "file": "养老年金/样例_海港金彩颐年悦享版养老年金.json", "category": "养老年金", "shelf": "主产品", "short": "海港金彩颐年"},
    {"id": "ci-zhonghong-shuangxing", "file": "重大疾病/样例_中宏健康双星守护版重疾.json", "category": "重大疾病", "shelf": "主产品", "short": "中宏健康双星"},
    {"id": "medical-picc-2024", "file": "医疗险/样例_人保住院医疗2024.json", "category": "住院医疗", "shelf": "对照", "short": "人保住院医疗"},
)
PRODUCT_IDS = tuple(item["id"] for item in SPECS)
LEGACY_PRODUCTS = ("qianxin", "sample-medical", "ride-accident", "clinic-gap")
POLICY_LINKS = {"DEMO-01": "life-zhongying-xinyue", "DEMO-02": "ci-zhonghong-shuangxing"}


def available():
    return CLAUSE_DIR.is_dir() and all((CLAUSE_DIR / spec["file"]).is_file() for spec in SPECS)


def _exclusions(raw):
    value = raw.get("责任免除")
    groups = value if isinstance(value, list) else ([value] if isinstance(value, dict) else [])
    rows = []
    for index, group in enumerate(groups, 1):
        if not isinstance(group, dict):
            continue
        rows.append({
            "position": index,
            "scope": str(group.get("适用范围") or ""),
            "item_count": group.get("免责条数") if isinstance(group.get("免责条数"), int) else None,
            "body": str(group.get("原文") or ""),
            "cite": str(group.get("出处") or ""),
            "note": str(group.get("值得关注的条目") or ""),
        })
    return rows


def _body(spec, raw, duties, exclusions):
    info = raw.get("产品信息") or {}
    lines = [
        f"【产品信息】{spec['short']}",
        f"身份：外部公开条款的结构化样例。保险公司是{info.get('保险公司', '')}，产品名称是{info.get('产品名称', '')}。不是示意保险的在售产品。",
    ]
    for key, value in info.items():
        if value is None or value == "":
            continue
        lines.append(f"{key}：{value}。出处：产品信息。")
    for duty in duties:
        lines.append("")
        lines.append(f"【保险责任】{duty['name']}")
        lines.append(f"责任类型：{duty['kind']}。必选或可选：{duty['required']}。出处：{duty['cite']}。")
        payload = duty["payload"]
        for key in ("赔付说明", "给付基准", "领取金额算法", "行使条件", "赔付比例", "间隔期天数", "领取起始年龄"):
            if payload.get(key) not in (None, ""):
                lines.append(f"{key}：{payload[key]}。")
    for group in exclusions:
        lines.append("")
        lines.append(f"【责任免除】{group['scope']}")
        lines.append(f"出处：{group['cite']}。{group['body']}")
        if group["note"]:
            lines.append(f"值得关注：{group['note']}")
    other = raw.get("其他免责提示")
    if isinstance(other, dict) and other.get("说明"):
        lines.append("")
        lines.append(f"【其他免责提示】出处：{other.get('出处') or ''}。{other.get('说明')}。分布：{other.get('分布位置') or ''}")
    return "\n".join(lines)


def _steps(spec, info, duties, exclusions):
    filled = sum(1 for value in info.values() if value not in (None, ""))
    return [
        {"position": 1, "name": "导入", "detail": f"读入{spec['file']}，保留{info.get('保险公司', '')}和产品原名。"},
        {"position": 2, "name": "清洗", "detail": "空字段不写成0；责任免除无论原来是一组还是多组，都收成免除表。"},
        {"position": 3, "name": "分类", "detail": f"归入{spec['category']}，上架位置是{spec['shelf']}。人保住院医疗只作对照。"},
        {"position": 4, "name": "结构化", "detail": f"产品信息{filled}项，保险责任{len(duties)}条，责任免除{len(exclusions)}组。每条责任和免除保留条款出处。"},
        {"position": 5, "name": "发布", "detail": "写入已发布资料，身份是外部资料待专业核实。智能体回答时先查这些字段，再查原文段落。"},
    ]


def load():
    if not available():
        return []
    records = []
    for spec in SPECS:
        raw = json.loads((CLAUSE_DIR / spec["file"]).read_text(encoding="utf-8"))
        info = dict(raw.get("产品信息") or {})
        hint = raw.get("其他免责提示") if isinstance(raw.get("其他免责提示"), dict) else {}
        located = re.search(r"(\d+(?:\.\d+)*)等待期", str((hint or {}).get("分布位置") or ""))
        if located:
            info["等待期条款位置"] = located.group(1)
        duties = []
        for index, duty in enumerate(raw.get("保险责任") or [], 1):
            if not isinstance(duty, dict):
                continue
            duties.append({
                "position": index,
                "name": str(duty.get("责任名称") or ""),
                "kind": str(duty.get("责任类型") or ""),
                "required": str(duty.get("必选或可选") or ""),
                "cite": str(duty.get("出处") or ""),
                "payload": duty,
            })
        exclusions = _exclusions(raw)
        records.append({
            "id": spec["id"],
            "company": str(info.get("保险公司") or ""),
            "name": str(info.get("产品名称") or spec["short"]),
            "category": spec["category"],
            "shelf": spec["shelf"],
            "short": spec["short"],
            "source_file": spec["file"].replace("\\", "/"),
            "source_note": SOURCE_NOTE,
            "info": info,
            "duties": duties,
            "exclusions": exclusions,
            "steps": _steps(spec, info, duties, exclusions),
            "body": _body(spec, raw, duties, exclusions),
        })
    return records
