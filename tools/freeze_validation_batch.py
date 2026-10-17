"""Freeze a reproducible, secret-free validation snapshot for the BaoSu demo."""
from __future__ import annotations

import hashlib
import argparse
import json
import os
import platform
import shutil
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BATCH = "VAL-20261018-01"

INCLUDE_FILES = [
    "app.py",
    "consultation.py",
    "clause_query.py",
    "company_library.py",
    "compliance_rules.py",
    "external_material.py",
    "illustrations.py",
    "insurance_content.py",
    "life_catalog.py",
    "platform_ops.py",
    "portal_hub.py",
    "product_design.py",
    "simulation.py",
    "launch.py",
    "start.ps1",
    "启动保智协同.cmd",
    "README.md",
    "PROJECT.md",
    "ITERATIONS.md",
    "保溯中台-数据处理与整合流程说明.md",
    "第六章-系统验证与效果分析-IT执行指南.md",
    "tools/validation_cases_20261018.json",
    "tools/run_validation_batch.py",
]
INCLUDE_DIRS = ["static", "tests"]


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def configured_model() -> dict:
    values: dict[str, str] = {}
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8-sig").splitlines():
            if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key.strip().startswith("BAOZHI_"):
                values[key.strip()] = value.strip().strip('"').strip("'")
    for key in ("BAOZHI_MODEL", "BAOZHI_ENABLE_THINKING", "BAOZHI_PORT"):
        if os.environ.get(key):
            values[key] = os.environ[key]
    return {
        "provider": "OpenAI-compatible API",
        "model": values.get("BAOZHI_MODEL", "not-recorded"),
        "thinking_enabled": values.get("BAOZHI_ENABLE_THINKING", "not-recorded"),
        "api_key_configured": bool(os.environ.get("BAOZHI_API_KEY") or values.get("BAOZHI_API_KEY")),
        "endpoint_configured": bool(os.environ.get("BAOZHI_MODEL_URL") or values.get("BAOZHI_MODEL_URL")),
        "secret_values_in_manifest": False,
    }


def selected_sources() -> list[Path]:
    files = [ROOT / name for name in INCLUDE_FILES]
    for directory in INCLUDE_DIRS:
        files.extend(path for path in (ROOT / directory).rglob("*") if path.is_file())
    files.append(Path(__file__).resolve())
    return sorted({path.resolve() for path in files if path.exists()}, key=lambda p: p.as_posix())


def app_identity() -> dict:
    text = (ROOT / "app.py").read_text(encoding="utf-8")
    import re
    version = re.search(r'^VERSION\s*=\s*["\']([^"\']+)', text, re.M)
    build = re.search(r'^BUILD\s*=\s*["\']([^"\']+)', text, re.M)
    return {"version": version.group(1) if version else "not-recorded", "build": build.group(1) if build else "not-recorded"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", default=BATCH)
    args = parser.parse_args()
    batch = args.batch
    out = ROOT / "docs" / "验证" / batch
    snapshot = out / "snapshot"
    out.mkdir(parents=True, exist_ok=True)
    snapshot.mkdir(parents=True, exist_ok=True)
    database = ROOT / "data" / "baozhi.sqlite3"
    if not database.exists():
        raise SystemExit("data/baozhi.sqlite3 does not exist")

    db_copy = snapshot / "baozhi.sqlite3"
    shutil.copy2(database, db_copy)

    sources = selected_sources()
    source_zip = snapshot / "source-snapshot.zip"
    with zipfile.ZipFile(source_zip, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sources:
            archive.write(path, path.relative_to(ROOT).as_posix())

    source_rows = []
    for path in sources:
        source_rows.append({
            "path": path.relative_to(ROOT).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": digest(path),
        })

    now = datetime.now(timezone.utc).astimezone()
    manifest = {
        "batch_id": batch,
        "frozen_at": now.isoformat(timespec="seconds"),
        "application": app_identity(),
        "source_identity": {
            "git_commit": None,
            "reason": "The project directory is not a Git working tree; a source archive and SHA-256 list are used instead.",
            "archive": str(source_zip.relative_to(ROOT)).replace("\\", "/"),
            "archive_sha256": digest(source_zip),
            "files": source_rows,
        },
        "database": {
            "source": "data/baozhi.sqlite3",
            "copy": str(db_copy.relative_to(ROOT)).replace("\\", "/"),
            "bytes": db_copy.stat().st_size,
            "sha256": digest(db_copy),
            "contains_real_customer_data": False,
            "use": "fictional local demo and historical test records",
        },
        "runtime": {
            "python": sys.version.split()[0],
            "implementation": platform.python_implementation(),
            "os": platform.platform(),
            "machine": platform.machine(),
            "timezone": str(now.tzinfo),
        },
        "model": configured_model(),
        "scope": {
            "real_business_systems_connected": False,
            "real_customers_or_policies": False,
            "live_phone_or_wechat": False,
        },
    }
    (out / "snapshot.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / "source-files.sha256").write_text(
        "".join(f"{row['sha256']}  {row['path']}\n" for row in source_rows), encoding="utf-8"
    )
    print(json.dumps({
        "batch": batch,
        "files": len(source_rows),
        "source_archive_sha256": manifest["source_identity"]["archive_sha256"],
        "database_sha256": manifest["database"]["sha256"],
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
