"""Windows 双击入口的标准库启动器；不依赖 PowerShell 执行策略。"""
from __future__ import annotations

import argparse
from http.client import HTTPException
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from urllib.request import ProxyHandler, build_opener
import webbrowser

ROOT = Path(__file__).resolve().parent


def configured_port(root=ROOT):
    """只取启动端口，不打印或将其他配置写入启动日志。"""
    value = os.environ.get("BAOZHI_PORT")
    path = root / ".env"
    if value is None and path.exists():
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            key, sep, candidate = line.partition("=")
            if sep and key.strip() == "BAOZHI_PORT":
                value = candidate.strip().strip('"').strip("'")
                break
    try:
        port = int(value if value is not None else "8765")
        if not 1 <= port <= 65535:
            raise ValueError
        return port
    except ValueError:
        raise RuntimeError("BAOZHI_PORT 必须是 1 到 65535 的整数，请检查本机配置。") from None


def current_service(port):
    from app import VERSION, BUILD
    try:
        # 本机健康检查不经过用户可能设置的外网代理。
        opener = build_opener(ProxyHandler({}))
        with opener.open(f"http://127.0.0.1:{port}/api/health", timeout=0.5) as response:
            health = json.loads(response.read(4096))
        return (isinstance(health, dict) and health.get("ok") is True
                and health.get("local_only") is True
                and health.get("version") == VERSION and health.get("build") == BUILD)
    except (OSError, ValueError, HTTPException):
        return False


def free_port(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        if os.name == "nt":
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        try:
            probe.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def select_port(base):
    candidates = range(base, min(base + 9, 65535) + 1)
    # 优先复用，包括较早端口腾空、但后续端口已有当前服务的情况。
    first_free = None
    for port in candidates:
        # 空闲端口无须发HTTP请求；Windows连接无人监听的端口可能等待超时。
        if free_port(port):
            if first_free is None:
                first_free = port
        elif current_service(port):
            return port, True
    if first_free is not None:
        return first_free, False
    raise RuntimeError("附近 10 个端口均不可用。请核对旧保溯进程，或修改 BAOZHI_PORT 后重试。")


def start_service(root, port):
    data = root / "data"
    data.mkdir(exist_ok=True)
    with (data / "server.log").open("ab") as output, (data / "server-error.log").open("ab") as errors:
        process = subprocess.Popen(
            [sys.executable, "-X", "utf8", str(root / "app.py"), "--port", str(port)],
            cwd=str(root), stdin=subprocess.DEVNULL, stdout=output, stderr=errors,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            close_fds=True,
        )
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError("服务启动失败，请查看 data/server-error.log。")
        if current_service(port):
            (data / "server.pid").write_text(str(process.pid), encoding="ascii")
            return
        time.sleep(0.25)
    # 不自动终止进程；超时不代表进程已退出。
    raise RuntimeError(f"服务就绪检查超时（本次进程 {process.pid}）。请查看 data/server-error.log 后重试。")


def main(argv=None):
    parser = argparse.ArgumentParser(description="保溯本机启动器（无需 PowerShell 脚本权限）")
    parser.add_argument("--no-browser", action="store_true", help="启动后不自动打开浏览器")
    args = parser.parse_args(argv)
    if sys.version_info < (3, 11):
        print("需要 Python 3.11 或更新版本。", file=sys.stderr)
        return 1
    try:
        print("[1/3] 正在检查本机端口和已有服务…", flush=True)
        port, running = select_port(configured_port(ROOT))
        if not running:
            print(f"[2/3] 正在启动服务（端口 {port}），等待就绪…", flush=True)
            start_service(ROOT, port)
        else:
            print(f"[2/3] 已找到当前版本服务（端口 {port}），直接复用。", flush=True)
        url = f"http://127.0.0.1:{port}"
        (ROOT / "data").mkdir(exist_ok=True)
        (ROOT / "data" / "server.url").write_text(url + "\n", encoding="ascii")
        print(f"保溯{'已在运行' if running else '已启动'}：{url}", flush=True)
        if not args.no_browser:
            print("[3/3] 正在打开浏览器；若没有弹出网页，请复制上面的地址手动打开。", flush=True)
            try:
                if not webbrowser.open(url):
                    print("浏览器未自动打开，请复制上面的地址到浏览器。")
            except OSError:
                print("浏览器未自动打开，请复制上面的地址到浏览器。")
        else:
            print("[3/3] 服务已就绪，按参数要求不自动打开浏览器。", flush=True)
        return 0
    except (RuntimeError, OSError):
        # 不输出包含环境配置的异常对象或供应商响应。
        error = sys.exception()
        print(str(error) if isinstance(error, RuntimeError) else "无法启动：请检查项目目录权限及 data/server-error.log。", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
