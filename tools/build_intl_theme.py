"""Generate static/intl-theme.css: the dark palette of home.html applied to the console stylesheets.

Reads the console stylesheets in the order index.html loads them and re-emits every colour
declaration with a dark equivalent. Run again after changing any of the source stylesheets:

    python tools/build_intl_theme.py
"""
from __future__ import annotations

import colorsys
import re
from pathlib import Path

STATIC = Path(__file__).resolve().parents[1] / "static"
SOURCES = ("style.css", "console-v03.css", "portal.css", "theme.css", "workbench.css",
           "workbench-motion.css", "experience.css", "desk-polish.css", "refinement.css")
OUT = STATIC / "intl-theme.css"

COLOR = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\bwhite\b|\bblack\b")
PROPS = re.compile(r"^(background(?:-color|-image)?|color|border(?:-top|-right|-bottom|-left)?(?:-color)?|outline(?:-color)?|box-shadow|fill|stroke|text-decoration-color|caret-color|accent-color|--[\w-]+)$")


def parse_color(raw):
    raw = raw.strip().lower()
    if raw == "white":
        return 255, 255, 255, 1.0
    if raw == "black":
        return 0, 0, 0, 1.0
    if raw.startswith("#"):
        h = raw[1:]
        if len(h) in (3, 4):
            h = "".join(ch * 2 for ch in h)
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return r, g, b, a
    parts = [p.strip() for p in raw[raw.index("(") + 1:-1].replace("/", ",").split(",") if p.strip()]
    if len(parts) < 3 or any("var" in p for p in parts):
        return None
    try:
        r, g, b = (float(p.rstrip("%")) * (2.55 if p.endswith("%") else 1) for p in parts[:3])
        a = float(parts[3].rstrip("%")) / (100 if parts[3].endswith("%") else 1) if len(parts) > 3 else 1.0
    except ValueError:
        return None
    return r, g, b, a


def fmt(r, g, b, a):
    r, g, b = (max(0, min(255, round(v))) for v in (r, g, b))
    if a >= 0.999:
        return f"#{r:02x}{g:02x}{b:02x}"
    return f"rgba({r},{g},{b},{a:.2f})".replace("0.", ".")


def hls(rgb):
    return colorsys.rgb_to_hls(*(v / 255 for v in rgb))


def from_hls(h, l, s, a):
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return fmt(r * 255, g * 255, b * 255, a)


def accent_for(h, s):
    """Saturated source accents collapse onto the two accents of home.css."""
    deg = h * 360
    if s < 0.18:
        return None
    if deg < 18 or deg >= 340:
        return (255, 155, 143)
    if deg < 60:
        return (242, 184, 114)
    return (157, 185, 255)


def map_background(c):
    r, g, b, a = c
    h, l, s = hls((r, g, b))
    if l >= 0.985:
        return fmt(16, 21, 31, a)           # raised card
    if l >= 0.9 and s < 0.35:
        return fmt(10, 14, 21, a)           # page surface
    if l >= 0.78:
        return from_hls(h if s > 0.12 else 0.61, 0.13, min(s, 0.35), a)   # tinted selection
    if l >= 0.4:
        return from_hls(h, 0.2, min(s, 0.4), a)
    if s >= 0.2 and l >= 0.12:
        return fmt(31, 45, 78, a)           # accent fill (primary buttons, active chips)
    return fmt(18, 24, 36, a)               # dark panels


def map_text(c):
    r, g, b, a = c
    h, l, s = hls((r, g, b))
    if l >= 0.8:
        return fmt(238, 241, 246, a)
    if s >= 0.28 and 0.25 <= l <= 0.72:
        acc = accent_for(h, s)
        if acc:
            return fmt(*acc, a)
    if l < 0.25:
        return fmt(238, 241, 246, a)
    if l < 0.42:
        return fmt(205, 211, 221, a)
    if l < 0.6:
        return fmt(160, 168, 182, a)
    return fmt(132, 141, 156, a)


def map_border(c):
    r, g, b, a = c
    h, l, s = hls((r, g, b))
    if s >= 0.3 and l < 0.6:
        acc = accent_for(h, s) or (157, 185, 255)
        return fmt(*acc, min(a, 0.55))
    if l >= 0.72:
        return fmt(255, 255, 255, 0.10 * a if a < 1 else 0.10)
    return fmt(255, 255, 255, 0.18 * a if a < 1 else 0.18)


def map_shadow(c):
    r, g, b, a = c
    return fmt(0, 0, 0, min(0.55, a * 2.5))


VAR_BG = ("bg", "paper", "light", "wash", "field", "control", "inset", "raised", "surface", "card", "panel")
VAR_LINE = ("line", "rule", "border")


def mapper_for(prop):
    if prop.startswith("--"):
        name = prop.lower()
        if "shadow" in name:
            return map_shadow
        if any(k in name for k in VAR_LINE):
            return map_border
        if any(k in name for k in VAR_BG):
            return map_background
        return map_text
    if prop.startswith("background"):
        return map_background
    if prop.startswith(("border", "outline")):
        return map_border
    if prop == "box-shadow":
        return map_shadow
    return map_text


def convert(prop, value):
    fn = mapper_for(prop)
    changed = False

    def sub(m):
        nonlocal changed
        parsed = parse_color(m.group(0))
        if not parsed:
            return m.group(0)
        changed = True
        return fn(parsed)

    out = COLOR.sub(sub, value)
    return out if changed else None


def strip_comments(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def blocks(css):
    """Yield (prelude, body) for top-level blocks, keeping nested at-rule bodies raw."""
    i, n = 0, len(css)
    while i < n:
        start = css.find("{", i)
        if start < 0:
            return
        prelude = css[i:start].strip()
        depth, j = 1, start + 1
        while j < n and depth:
            if css[j] == "{":
                depth += 1
            elif css[j] == "}":
                depth -= 1
            j += 1
        yield prelude, css[start + 1:j - 1]
        i = j


def declarations(body):
    for part in body.split(";"):
        if ":" not in part:
            continue
        prop, value = part.split(":", 1)
        yield prop.strip().lower(), value.strip()


def emit(css, out):
    for prelude, body in blocks(css):
        if prelude.startswith("@"):
            if prelude.startswith(("@media", "@supports", "@layer")):
                inner = []
                emit(body, inner)
                if inner:
                    out.append(prelude + "{\n" + "\n".join(inner) + "\n}")
            continue
        lines = []
        for prop, value in declarations(body):
            if not PROPS.match(prop):
                continue
            converted = convert(prop, value)
            if converted:
                lines.append(f"{prop}:{converted}")
        if lines:
            out.append(prelude + "{" + ";".join(lines) + "}")


def main():
    out = ["/* Generated by tools/build_intl_theme.py. Do not edit by hand; put manual overrides in intl.css. */"]
    for name in SOURCES:
        rules = []
        emit(strip_comments((STATIC / name).read_text(encoding="utf-8")), rules)
        out.append(f"/* {name} */")
        out.extend(rules)
    OUT.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(STATIC.parent)} ({sum(1 for line in out if '{' in line)} rules)")


if __name__ == "__main__":
    main()
