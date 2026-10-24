"""Lifecycle/guard tests use disposable loopback processes, never an external service."""
import argparse
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

spec = importlib.util.spec_from_file_location("native", Path(__file__).with_name("native.py"))
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)

FAKE_SERVICE = '''
import argparse,json,os,time
from http.server import BaseHTTPRequestHandler,HTTPServer
p=argparse.ArgumentParser()
p.add_argument('command')
p.add_argument('--token')
p.add_argument('--port',type=int)
p.add_argument('--languages')
args=p.parse_args()
time.sleep(float(os.environ.get('FAKE_START_DELAY','0')))
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  value={'status':'ok'} if self.path=='/health' else [{'code':c,'targets':['en','bn']} for c in ['en','bn']]
  self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(value).encode())
HTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
'''


class NativeGuards(unittest.TestCase):
    def test_language_codes_are_explicit_and_require_english(self):
        self.assertEqual(native.languages("en,bn,en"), ["en", "bn"])
        for value in ("bn", "en", "en,bn;--host", "en,../fr", "en,FR"):
            with self.subTest(value=value), self.assertRaises(native.LocalError):
                native.languages(value)

    def test_ports_are_bounded(self):
        for value in ("abc", 0, -1, 65536):
            with self.subTest(value=value), self.assertRaises(native.LocalError):
                native.integer(value, "Port")
        self.assertEqual(native.integer(5001, "Port"), 5001)

    def test_occupied_port_is_reported_without_stopping_its_owner(self):
        with socket.socket() as listener:
            listener.bind((native.HOST, 0))
            port = listener.getsockname()[1]
            with self.assertRaisesRegex(native.LocalError, "occupied"):
                native.assert_port_available(port)
            self.assertEqual(listener.getsockname()[1], port)

    def test_live_wildcard_reuse_listener_cannot_be_shadowed_on_macos(self):
        with socket.socket() as listener:
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            listener.bind(("0.0.0.0", 0))
            listener.listen(1)
            with self.assertRaisesRegex(native.LocalError, "occupied"):
                native.assert_port_available(listener.getsockname()[1])

    def test_child_environment_cannot_select_remote_providers_or_global_pip(self):
        with tempfile.TemporaryDirectory() as temporary, mock.patch.object(native, "STATE", Path(temporary)), mock.patch.dict(native.os.environ, {
            "LT_HOST": "0.0.0.0", "LT_DEBUG": "true", "ARGOS_MODEL_PROVIDER": "OPENAI", "PIP_TARGET": "/global",
            "PIP_USER": "true", "PIP_PREFIX": "/global", "PYTHONPATH": "/elsewhere", "VIRTUAL_ENV": "/other",
        }):
            env = native.clean_environment()
        for key in ("LT_HOST", "LT_DEBUG", "ARGOS_MODEL_PROVIDER", "PIP_TARGET", "PIP_USER", "PIP_PREFIX", "PYTHONPATH", "VIRTUAL_ENV"):
            self.assertNotIn(key, env)
        self.assertEqual(env["ARGOS_DEVICE_TYPE"], "cpu")
        self.assertTrue(env["XDG_CACHE_HOME"].endswith("/cache"))

    def test_unpinned_lock_is_rejected_before_pip_runs(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "bad.lock"
            for value in ("libretranslate>=1.9.6", "-e https://example.test/repository", "libretranslate==1.9.5"):
                path.write_text(value)
                with self.subTest(value=value), self.assertRaises(native.LocalError):
                    native.checked_lock(path)

    def test_environment_directory_resolves_symlinks_and_traversal(self):
        with tempfile.TemporaryDirectory() as temporary, tempfile.TemporaryDirectory() as outside:
            root = Path(temporary).resolve()
            with mock.patch.object(native, "ROOT", root):
                self.assertEqual(native.checked_venv_directory(root / ".venv"), root / ".venv")
                self.assertEqual(native.checked_venv_directory(root / ".venvs" / "candidate"), root / ".venvs" / "candidate")
                (root / ".venv").symlink_to(outside, target_is_directory=True)
                with self.assertRaises(native.LocalError):
                    native.checked_venv_directory(root / ".venv")
                with self.assertRaises(native.LocalError):
                    native.checked_venv_directory(root / ".venvs" / ".." / ".." / "external")
                (root / ".venvs").symlink_to(outside, target_is_directory=True)
                with self.assertRaises(native.LocalError):
                    native.checked_venv_directory(root / ".venvs" / "candidate")

    def test_checked_real_lock_contains_compatible_release_and_build_tooling(self):
        path = native.ROOT / "requirements-macos-arm64-py311.lock"
        self.assertEqual(native.checked_lock(path), path)
        content = path.read_text()
        for pin in ("libretranslate==1.9.6", "wheel==0.45.1", "packaging==23.1", "chardet==5.2.0"):
            self.assertIn(pin, content)

    def test_system_python_or_other_python_minor_is_rejected(self):
        with mock.patch.object(native.subprocess, "check_output", return_value="CPython 3 9"), self.assertRaises(native.LocalError):
            native.checked_python(sys.executable)

    def test_process_identity_rejects_creation_time_token_or_command_mismatch(self):
        snapshot = {"created": "Tue Oct 13 10:00:00 2026", "command": f"python {native.SCRIPT} serve --token token"}
        record = {"pid": 123, "token": "token", **snapshot}
        with mock.patch.object(native, "process_snapshot", return_value=snapshot):
            self.assertTrue(native.owned_process(record))
            self.assertFalse(native.owned_process({**record, "created": "old creation time"}))
            self.assertFalse(native.owned_process({**record, "token": "wrong"}))
            self.assertFalse(native.owned_process({**record, "command": "unrelated process"}))

    def test_pip_uses_venv_only_hashes_and_pinned_build_tooling(self):
        with tempfile.TemporaryDirectory() as temporary, mock.patch.object(native, "STATE", Path(temporary)), mock.patch.object(native.subprocess, "run") as run, mock.patch.object(native, "validate_environment"):
            native.pip_install(Path("/venv/bin/python"), native.ROOT / "requirements-macos-arm64-py311.lock")
        install_calls = run.call_args_list[:2]
        self.assertEqual(len(install_calls), 2)
        for call in install_calls:
            command = call.args[0]
            self.assertEqual(command[:4], ["/venv/bin/python", "-I", "-m", "pip"])
            self.assertIn("--require-hashes", command)
            self.assertIn("--no-build-isolation", command)
            self.assertEqual(call.kwargs["env"]["PIP_REQUIRE_VIRTUALENV"], "1")
            self.assertEqual(call.kwargs["env"]["PIP_CONFIG_FILE"], native.os.devnull)


class NativeLifecycle(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.script = self.root / "fake_service.py"
        self.script.write_text(FAKE_SERVICE)
        self.processes = []
        actual_popen = subprocess.Popen
        def tracked_popen(*args, **kwargs):
            process = actual_popen(*args, **kwargs)
            self.processes.append(process)
            return process
        self.patches = [
            mock.patch.object(native, "ROOT", self.root), mock.patch.object(native, "SCRIPT", self.script),
            mock.patch.object(native, "STATE", self.root / "state"), mock.patch.object(native, "PID_FILE", self.root / "state" / "run" / "service.json"),
            mock.patch.object(native, "RUNTIME", self.root / "runtime.json"),
            mock.patch.object(native, "active_python", return_value=Path(sys.executable)),
            mock.patch.object(native, "validate_environment"), mock.patch.object(native, "assert_installed_models"),
            mock.patch.object(native.subprocess, "Popen", side_effect=tracked_popen),
        ]
        for patch in self.patches:
            patch.start()
        with socket.socket() as probe:
            probe.bind((native.HOST, 0))
            self.port = probe.getsockname()[1]
        self.arguments = argparse.Namespace(port=str(self.port), languages="en,bn", timeout="5", foreground=False)
        self.output = contextlib.redirect_stdout(io.StringIO())
        self.output.__enter__()

    def tearDown(self):
        record = native.read_json(native.PID_FILE)
        if native.owned_process(record):
            native.stop_record(record, 5)
        for process in self.processes:
            process.wait(timeout=5)
        self.output.__exit__(None, None, None)
        for patch in reversed(self.patches):
            patch.stop()
        self.temporary.cleanup()

    def test_start_is_loopback_only_and_idempotent_stop_retains_models(self):
        (native.STATE / "data").mkdir(parents=True)
        model = native.STATE / "data" / "retained-model"
        model.write_text("persistent fixture")
        native.start(self.arguments)
        initial = native.read_json(native.PID_FILE)
        self.assertTrue(native.owned_process(initial))
        self.assertEqual(native.healthy(self.port, ["en", "bn"])[0]["code"], "en")
        native.start(self.arguments)
        self.assertEqual(native.read_json(native.PID_FILE)["pid"], initial["pid"])
        native.stop(argparse.Namespace(timeout="5"))
        self.assertFalse(native.PID_FILE.exists())
        self.assertTrue(model.exists())
        native.assert_port_available(self.port)

    def test_start_refuses_different_config_while_owned_process_runs(self):
        native.start(self.arguments)
        changed = argparse.Namespace(**{**vars(self.arguments), "port": str(self.port + 1)})
        with self.assertRaisesRegex(native.LocalError, "another configuration"):
            native.start(changed)

    def test_stale_pid_record_never_kills_unrelated_process(self):
        unrelated = subprocess.Popen([sys.executable, "-c", "import time;time.sleep(30)"])
        try:
            snapshot = native.process_snapshot(unrelated.pid)
            native.atomic_json(native.PID_FILE, {"pid": unrelated.pid, "token": "wrong", **snapshot})
            native.stop(argparse.Namespace(timeout="1"))
            self.assertIsNone(unrelated.poll())
            self.assertFalse(native.PID_FILE.exists())
        finally:
            unrelated.terminate()
            unrelated.wait(timeout=5)

    def test_start_refuses_occupied_port_without_mutating_existing_owner(self):
        with socket.socket() as listener:
            listener.bind((native.HOST, self.port))
            with self.assertRaisesRegex(native.LocalError, "occupied"):
                native.start(self.arguments)
            self.assertFalse(native.PID_FILE.exists())
            self.assertEqual(listener.getsockname()[1], self.port)

    def test_readiness_timeout_stops_only_new_owned_process_and_removes_state(self):
        self.arguments.timeout = "1"
        with mock.patch.dict(native.os.environ, {"FAKE_START_DELAY": "30"}):
            with self.assertRaisesRegex(native.LocalError, "timed out"):
                native.start(self.arguments)
        self.assertFalse(native.PID_FILE.exists())
        native.assert_port_available(self.port)


if __name__ == "__main__":
    unittest.main()
