"""读取课程作业里的利益演示表。只给展业页查看，不进入对话检索，也不让模型报收益率。"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEMO_DIR = ROOT / "参考资料" / "保险实践课程作业的资料" / "利益演示数据"
NOTICE = "分红不保证，实际以公司公布为准。下表是公开利益演示，不是示意保险的报价，也不能当作保证利益。"
AGES = {"0", "30", "45"}
PAYS = {"1", "10"}
SHOW_YEARS = ("1", "2", "3", "5", "10", "15", "20")


def _series(value):
    if not isinstance(value, dict):
        return None, {}
    for key, inner in value.items():
        if isinstance(inner, dict) and any(str(year).isdigit() for year in inner):
            return str(key), {str(year): inner[year] for year in inner}
        if isinstance(inner, dict):
            for name, years in inner.items():
                if isinstance(years, dict):
                    return str(name), {str(year): years[year] for year in years}
    return None, {}


def _cell(mapping, year):
    if not isinstance(mapping, dict):
        return ""
    value = mapping.get(year, mapping.get(int(year), ""))
    return "" if value in (None, "-") else str(value)


def scan():
    if not DEMO_DIR.is_dir():
        return []
    grouped = {}
    for path in sorted(DEMO_DIR.rglob("*.json")):
        stem = path.stem.replace("，", ",").replace("、", ",")
        parts = [part.strip() for part in stem.split(",")]
        if len(parts) < 4:
            continue
        pay, age, gender = parts[-1], parts[-2], parts[-3]
        if gender not in ("男", "女") or age not in AGES or pay not in PAYS:
            continue
        name = ",".join(parts[:-3]).strip()
        grouped.setdefault(name, []).append({"gender": gender, "age": int(age), "pay": int(pay), "path": path})
    products = []
    for name, options in grouped.items():
        products.append({
            "id": name,
            "name": name,
            "options": [{"gender": item["gender"], "age": item["age"], "pay": item["pay"]} for item in options],
            "_files": {(item["gender"], item["age"], item["pay"]): item["path"] for item in options},
        })
    return products


def table(name, gender, age, pay):
    found = next((item for item in scan() if item["name"] == name), None)
    if not found:
        return None
    path = found["_files"].get((gender, int(age), int(pay)))
    if not path:
        return None
    raw = json.loads(path.read_text(encoding="utf-8"))
    row = raw[0] if isinstance(raw, list) and raw else raw
    if not isinstance(row, dict):
        return None
    bonus_name, bonus = _series(row.get("红利"))
    irr_name, irr = _series(row.get("IRR"))
    years = []
    for year in SHOW_YEARS:
        years.append({
            "year": int(year),
            "premium": _cell(row.get("保费"), year),
            "cash": _cell(row.get("现金价值"), year),
            "death": _cell(row.get("身故保险金"), year),
        })
    points = [{"year": item["year"], "cash": item["cash"]} for item in years if item["cash"].isdigit()]
    return {
        "name": name,
        "gender": gender,
        "age": int(age),
        "pay": int(pay),
        "notice": NOTICE,
        "years": years,
        "chart": points,
        "non_guaranteed": {
            "title": "演示利率下的非保证利益",
            "bonus_name": bonus_name or "",
            "bonus": [{"year": int(year), "value": _cell(bonus, year)} for year in ("1", "5", "10", "20")],
            "irr_name": irr_name or "",
            "irr": [{"year": int(year), "value": _cell(irr, year)} for year in ("10", "20")],
        },
    }


def public_list():
    return [{"id": item["name"], "name": item["name"], "options": item["options"]} for item in scan()]
