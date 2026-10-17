"""启动器回归：独立临时目录，不读用户密钥、不触碰业务数据库。"""
import contextlib
import io
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import Mock, patch
from urllib.request import Request, ProxyHandler, build_opener

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import launch
from app import VERSION, BUILD


class LauncherTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def test_config_default_file_and_environment_precedence(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(launch.configured_port(self.root), 8765)
            config = self.root / '.env'
            config.write_text('\ufeff# test\nBAOZHI_PORT="8771"\n', encoding='utf-8')
            before = config.read_bytes()
            self.assertEqual(launch.configured_port(self.root), 8771)
            os.environ['BAOZHI_PORT'] = '8772'
            self.assertEqual(launch.configured_port(self.root), 8772)
            self.assertEqual(config.read_bytes(), before)
            for value in ('0', '65536', 'secret-invalid-value', ''):
                os.environ['BAOZHI_PORT'] = value
                with self.assertRaises(RuntimeError) as caught:
                    launch.configured_port(self.root)
                self.assertNotIn('secret-invalid-value', str(caught.exception))

    def test_reuses_current_service_even_if_earlier_port_is_free(self):
        with patch.object(launch, 'current_service', side_effect=lambda p: p == 8767), patch.object(launch, 'free_port', side_effect=lambda p: p != 8767):
            self.assertEqual(launch.select_port(8765), (8767, True))

    def test_empty_ports_skip_slow_http_checks(self):
        with patch.object(launch, 'current_service') as health, patch.object(launch, 'free_port', return_value=True):
            self.assertEqual(launch.select_port(8765), (8765, False))
            health.assert_not_called()

    def test_skips_busy_port_and_bounds_search(self):
        with patch.object(launch, 'current_service', return_value=False), patch.object(launch, 'free_port', side_effect=lambda p: p == 8766):
            self.assertEqual(launch.select_port(8765), (8766, False))
        with patch.object(launch, 'current_service', return_value=False), patch.object(launch, 'free_port', return_value=False) as free:
            with self.assertRaises(RuntimeError):
                launch.select_port(65535)
            free.assert_called_once_with(65535)

    def test_health_recognizes_build_and_ignores_proxy(self):
        payload = {'ok': True, 'local_only': True, 'version': VERSION, 'build': BUILD}
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.end_headers()
                self.wfile.write(json.dumps(payload).encode())
            def log_message(self, *args):
                pass
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            port = server.server_address[1]
            with patch.dict(os.environ, {'HTTP_PROXY': 'http://127.0.0.1:1', 'http_proxy': 'http://127.0.0.1:1'}):
                self.assertTrue(launch.current_service(port))
                self.assertFalse(launch.free_port(port))
                payload['build'] = 'older-build'
                self.assertFalse(launch.current_service(port))
                payload['build'] = BUILD
                payload['local_only'] = False
                self.assertFalse(launch.current_service(port))
        finally:
            server.shutdown()
            worker.join(timeout=3)
            server.server_close()

    def test_spawn_is_hidden_preserves_logs_and_records_healthy_pid(self):
        data = self.root / 'data'
        data.mkdir()
        (data / 'server.log').write_bytes(b'old log\n')
        process = Mock(pid=12345)
        process.poll.return_value = None
        with patch.object(launch.subprocess, 'Popen', return_value=process) as spawn, patch.object(launch, 'current_service', return_value=True):
            launch.start_service(self.root, 8768)
        args, options = spawn.call_args
        self.assertEqual(args[0], [sys.executable, '-X', 'utf8', str(self.root/'app.py'), '--port', '8768'])
        self.assertEqual(options['cwd'], str(self.root))
        self.assertEqual(options['creationflags'], subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        self.assertEqual((data/'server.pid').read_text(), '12345')
        self.assertEqual((data/'server.log').read_bytes(), b'old log\n')

    def test_failed_start_does_not_record_false_success(self):
        process = Mock()
        process.poll.return_value = 1
        with patch.object(launch.subprocess, 'Popen', return_value=process):
            with self.assertRaisesRegex(RuntimeError, '启动失败'):
                launch.start_service(self.root, 8768)
        self.assertFalse((self.root/'data/server.pid').exists())

    def test_main_reuse_records_url_without_launch_or_browser(self):
        with patch.object(launch, 'ROOT', self.root), patch.object(launch, 'configured_port', return_value=8765), patch.object(launch, 'select_port', return_value=(8768, True)), patch.object(launch, 'start_service') as start, patch.object(launch.webbrowser, 'open') as browser, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(launch.main(['--no-browser']), 0)
        start.assert_not_called()
        browser.assert_not_called()
        self.assertEqual((self.root/'data/server.url').read_text().strip(), 'http://127.0.0.1:8768')

    def test_progress_precedes_port_check_and_browser_failure_keeps_address(self):
        output = io.StringIO()
        def select(base):
            self.assertIn('[1/3]', output.getvalue())
            return 8768, True
        with patch.object(launch, 'ROOT', self.root), patch.object(launch, 'configured_port', return_value=8765), patch.object(launch, 'select_port', side_effect=select), patch.object(launch.webbrowser, 'open', return_value=False), contextlib.redirect_stdout(output):
            self.assertEqual(launch.main([]), 0)
        for expected in ('[2/3]', '[3/3]', 'http://127.0.0.1:8768', '浏览器未自动打开'):
            self.assertIn(expected, output.getvalue())

    def test_real_child_start_and_reuse_in_isolated_project(self):
        for name in ('app.py', 'consultation.py', 'insurance_content.py', 'product_design.py', 'portal_hub.py', 'external_material.py', 'company_library.py', 'life_catalog.py', 'clause_query.py', 'compliance_rules.py', 'illustrations.py', 'simulation.py', 'platform_ops.py', 'intl.py'):
            shutil.copy2(launch.ROOT / name, self.root / name)
        shutil.copytree(launch.ROOT / 'static', self.root / 'static')
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            port = probe.getsockname()[1]
        children = []
        popen = subprocess.Popen
        def capture_child(*args, **kwargs):
            process = popen(*args, **kwargs)
            children.append(process)
            return process
        try:
            with patch.object(launch.subprocess, 'Popen', side_effect=capture_child):
                launch.start_service(self.root, port)
            self.assertTrue(launch.current_service(port))
            opener = build_opener(ProxyHandler({}))
            base = f'http://127.0.0.1:{port}'
            for path in ('/', '/app.js', '/style.css', '/console-v03.css', '/susu-agent.svg'):
                with opener.open(base+path, timeout=3) as response:
                    self.assertEqual(response.status, 200)
                    self.assertTrue(response.read())
            request = Request(base+'/api/session', data=b'{"role":"viewer"}', headers={'Content-Type':'application/json'})
            with opener.open(request, timeout=3) as response:
                token = json.load(response)['token']
            with opener.open(Request(base+'/api/state', headers={'Authorization':'Bearer '+token}), timeout=3) as response:
                state = json.load(response)
                self.assertTrue(state['documents'])
                self.assertTrue(state['flows'])
                self.assertEqual(state['build'], BUILD)
            pid_before = (self.root/'data/server.pid').read_bytes()
            with patch.object(launch, 'ROOT', self.root), patch.object(launch, 'configured_port', return_value=port), patch.object(launch, 'start_service') as start, contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(launch.main(['--no-browser']), 0)
                start.assert_not_called()
            self.assertEqual((self.root/'data/server.pid').read_bytes(), pid_before)
        finally:
            # 仅清理本测试直接创建并持有句柄的子进程。
            for process in children:
                if process.poll() is None:
                    process.terminate()
                process.wait(timeout=10)

    @unittest.skipUnless(os.name == 'nt', 'Windows 双击入口')
    def test_real_cmd_help_runs_without_powershell(self):
        entry = launch.ROOT / '启动保智协同.cmd'
        self.assertNotIn('powershell', entry.read_text(encoding='utf-8').lower())
        result = subprocess.run([os.environ.get('COMSPEC', 'cmd.exe'), '/d', '/c', str(entry), '--help'], cwd=launch.ROOT, stdin=subprocess.DEVNULL, capture_output=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr.decode('utf-8', errors='replace'))
        self.assertIn(b'--no-browser', result.stdout)


if __name__ == '__main__':
    unittest.main()
