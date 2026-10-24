#!/usr/bin/env python3
"""Project-owned native LibreTranslate lifecycle; bootstrap uses the standard library.

The official package runs only in a dedicated CPython 3.11 virtual environment.
Models, caches, process state and logs live outside Git under this directory.
"""
from __future__ import annotations

import argparse
import contextlib
import errno
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parent
SCRIPT = Path(__file__).resolve()
STATE = ROOT / "state"
RUNTIME = ROOT / "runtime.json"
PID_FILE = STATE / "run" / "service.json"
VERSION = "1.9.6"
HOST = "127.0.0.1"
DEFAULT_PORT = 5001
DEFAULT_LANGUAGES = ["en", "bn"]


class LocalError(RuntimeError):
    pass


def read_json(path: Path, fallback=None):
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError) as exc:
        raise LocalError(f"Invalid local state file: {path}") from exc


def atomic_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + "." + uuid.uuid4().hex + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    temporary.chmod(0o600)
    temporary.replace(path)


def integer(value, label, minimum=1, maximum=65535):
    try:
        result = int(value)
    except (TypeError, ValueError) as exc:
        raise LocalError(f"{label} must be an integer") from exc
    if not minimum <= result <= maximum:
        raise LocalError(f"{label} must be between {minimum} and {maximum}")
    return result


def languages(value=None):
    if value is None:
        value = os.environ.get("LT_LANGUAGES")
    if value is None:
        value = read_json(STATE / "models.json", {}).get("languages", DEFAULT_LANGUAGES)
    values = value.split(",") if isinstance(value, str) else value
    if not isinstance(values, list) or not values:
        raise LocalError("Select at least English and one translation language")
    result = list(dict.fromkeys(code.strip() for code in values))
    if any(not re.fullmatch(r"[a-z]{2,3}(?:-[A-Za-z]{2,4})?", code) for code in result):
        raise LocalError("Language codes must be valid LibreTranslate language identifiers")
    if "en" not in result or len(result) < 2:
        raise LocalError("Select English and at least one target language, for example en,bn")
    return result


def clean_environment():
    # Never inherit another installation's bind address, remote model provider,
    # API secrets, automatic model updates, CUDA setting or Python import paths.
    env = {key: value for key, value in os.environ.items()
           if not key.startswith(("LT_", "ARGOS_", "PYTHON", "PIP_"))
           and key not in ("VIRTUAL_ENV", "XDG_DATA_HOME", "XDG_CACHE_HOME", "XDG_CONFIG_HOME")}
    for child in ("data", "cache", "config", "run", "logs"):
        (STATE / child).mkdir(parents=True, exist_ok=True)
    env.update({
        "XDG_DATA_HOME": str(STATE / "data"),
        "XDG_CACHE_HOME": str(STATE / "cache"),
        "XDG_CONFIG_HOME": str(STATE / "config"),
        "ARGOS_DEVICE_TYPE": "cpu",
        "ARGOS_INTER_THREADS": "1",
        "ARGOS_INTRA_THREADS": "2",
        "OMP_NUM_THREADS": "2",
        "OPENBLAS_NUM_THREADS": "2",
        "VECLIB_MAXIMUM_THREADS": "2",
        "PYTHONUNBUFFERED": "1",
    })
    return env


def process_snapshot(pid):
    """Use creation time plus the full command to reject stale/reused PID files."""
    try:
        created = subprocess.check_output(["ps", "-p", str(pid), "-o", "lstart="], text=True).strip()
        command = subprocess.check_output(["ps", "-ww", "-p", str(pid), "-o", "command="], text=True).strip()
    except subprocess.CalledProcessError:
        return None
    return {"created": created, "command": command} if created and command else None


def owned_process(record):
    if not isinstance(record, dict) or not isinstance(record.get("pid"), int):
        return False
    current = process_snapshot(record["pid"])
    return bool(current and current["created"] == record.get("created")
                and current["command"] == record.get("command")
                and str(SCRIPT) in current["command"]
                and f"--token {record.get('token')}" in current["command"])


@contextlib.contextmanager
def lifecycle_lock():
    # macOS/Linux POSIX advisory locks are released on crashes without stale locks.
    import fcntl
    (STATE / "run").mkdir(parents=True, exist_ok=True)
    with (STATE / "run" / "lifecycle.lock").open("a") as handle:
        try:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise LocalError("Another native translation lifecycle command is running") from exc
        try:
            yield
        finally:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def assert_port_available(port):
    # On macOS SO_REUSEADDR can let a specific bind shadow a live wildcard
    # listener (for example AirPlay). Probe connectivity before the reuse bind.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as connection:
        connection.settimeout(0.5)
        result = connection.connect_ex((HOST, port))
        if result != errno.ECONNREFUSED:
            raise LocalError(f"{HOST}:{port} is occupied or cannot be checked safely. Choose another LT_PORT; no existing process was stopped.")
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        # Permit a stopped listener's TIME_WAIT sockets without permitting a
        # second live listener; SO_REUSEPORT is deliberately never enabled.
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            probe.bind((HOST, port))
        except OSError as exc:
            raise LocalError(f"{HOST}:{port} is occupied. Choose another LT_PORT; no existing process was stopped.") from exc


def default_lock():
    operating_system = {"Darwin": "macos", "Linux": "linux"}.get(platform.system())
    machine = {"aarch64": "arm64", "x86_64": "x86_64", "arm64": "arm64"}.get(platform.machine())
    if not operating_system or not machine:
        raise LocalError("Native scripts support macOS and Linux; provide a reviewed platform lock")
    return ROOT / f"requirements-{operating_system}-{machine}-py311.lock"


def checked_lock(value=None):
    lock = Path(value).resolve() if value else default_lock()
    if not lock.is_file():
        raise LocalError(f"Missing reviewed dependency lock: {lock}. Create a platform-specific CPython 3.11 lock first.")
    lines = [line.strip().rstrip("\\").strip() for line in lock.read_text().splitlines()
             if line.strip() and not line.lstrip().startswith("#")]
    requirements = [line for line in lines if not line.startswith("--hash=sha256:")]
    if not requirements or any(not re.fullmatch(r"[A-Za-z0-9_.-]+(?:\[[A-Za-z0-9_,.-]+\])?==[^\s;]+(?:\s*;.+)?(?:\s+--hash=sha256:[a-f0-9]+)?", line)
                               for line in requirements):
        raise LocalError("Dependency locks must contain exact package==version pins only (with optional SHA256 hashes)")
    if not any(re.match(r"libretranslate==" + re.escape(VERSION) + r"(?:\s|$)", line, re.I) for line in requirements):
        raise LocalError(f"This lifecycle implementation requires libretranslate=={VERSION}")
    return lock


def checked_python(value=None):
    selected = value or os.environ.get("LT_PYTHON") or "python3.11"
    executable = shutil.which(selected)
    if not executable:
        raise LocalError("CPython 3.11 was not found. Install it separately, then pass install-local.sh --python /path/to/python3.11")
    result = subprocess.check_output([executable, "-I", "-c", "import platform,sys; print(platform.python_implementation(),sys.version_info.major,sys.version_info.minor)"], text=True).strip()
    if result != "CPython 3 11":
        raise LocalError("The checked dependency lock requires CPython 3.11; system Python will not be modified")
    return Path(executable).absolute()


def checked_venv_directory(value):
    root = ROOT.resolve()
    directory = Path(value).resolve()
    # Resolve symlinks and '..' on the directory, not on bin/python: the latter
    # normally links to the base interpreter outside the virtual environment.
    if directory != root / ".venv" and root / ".venvs" not in directory.parents:
        raise LocalError("Active environment must live in tools/libretranslate/.venv or .venvs")
    return directory


def active_python():
    record = read_json(RUNTIME, {})
    directory = checked_venv_directory(record.get("venv", ROOT / ".venv"))
    python = directory / "bin" / "python"
    if not (directory / "pyvenv.cfg").is_file() or not python.exists():
        raise LocalError("Native virtual environment is missing. Run scripts/translation/install-local.sh first")
    return python


def validate_environment(python):
    result = subprocess.check_output([str(python), "-I", "-c",
        "import importlib.metadata,json,sys; print(json.dumps({'venv':sys.prefix!=sys.base_prefix,'python':list(sys.version_info[:3]),'version':importlib.metadata.version('libretranslate')}))"], text=True)
    metadata = json.loads(result)
    if not metadata["venv"] or metadata["python"][:2] != [3, 11] or metadata["version"] != VERSION:
        raise LocalError(f"Expected a dedicated Python 3.11 venv with LibreTranslate {VERSION}")
    return metadata


def run_in_environment(python, code, *arguments):
    # Argos initializes MiniSBD's cache on import; apply our override afterward.
    preamble = "import argostranslate.sbd, minisbd.models, logging; logging.getLogger('argostranslate.utils').setLevel(logging.WARNING); minisbd.models.cache_dir = " + repr(str(STATE / "cache" / "minisbd")) + "\n"
    subprocess.run([str(python), "-I", "-c", preamble + code, *arguments], env=clean_environment(), cwd=ROOT, check=True)


def pip_install(python, lock):
    # Bootstrap build tooling from the same hash lock before building any sdist.
    # Build isolation would otherwise download unpinned latest build dependencies.
    blocks = re.split(r"(?m)(?=^[A-Za-z0-9_.-]+==)", lock.read_text())
    bootstrap = "".join(block for block in blocks if re.match(r"(?:pip|setuptools|wheel)==", block, re.I))
    if not bootstrap or not all(re.search(r"(?m)^" + name + r"==", bootstrap, re.I) for name in ("pip", "setuptools", "wheel")):
        raise LocalError("Dependency hash lock must also pin pip, setuptools and wheel")
    if "--hash=sha256:" not in bootstrap:
        raise LocalError("Dependency lock must include PyPI artifact SHA256 hashes")
    bootstrap_lock = STATE / "run" / "bootstrap.lock"
    bootstrap_lock.parent.mkdir(parents=True, exist_ok=True)
    bootstrap_lock.write_text(bootstrap)
    env = clean_environment()
    env.update({"PIP_CONFIG_FILE": os.devnull, "PIP_REQUIRE_VIRTUALENV": "1"})
    options = ["--disable-pip-version-check", "--no-input", "--require-hashes", "--no-build-isolation"]
    subprocess.run([str(python), "-I", "-m", "pip", "install", *options, "-r", str(bootstrap_lock)], env=env, check=True)
    subprocess.run([str(python), "-I", "-m", "pip", "install", *options, "-r", str(lock)], env=env, check=True)
    subprocess.run([str(python), "-I", "-m", "pip", "check"], env=env, check=True)
    validate_environment(python)


def install(args):
    lock = checked_lock(args.lock)
    python = checked_python(args.python)
    with lifecycle_lock():
        if owned_process(read_json(PID_FILE)):
            raise LocalError("Stop the native service before installing, or use update-local.sh to stage dependencies safely")
        directory = checked_venv_directory(ROOT / ".venv")
        active = read_json(RUNTIME, {}).get("venv")
        if active is not None and Path(active) != directory:
            raise LocalError("An updated environment is already active. Use update-local.sh rather than resetting it with install-local.sh")
        if not directory.exists():
            subprocess.run([str(python), "-I", "-m", "venv", str(directory)], check=True)
        elif not (directory / "pyvenv.cfg").is_file():
            raise LocalError("Existing .venv is not a virtual environment; it was left unchanged")
        venv_python = directory / "bin" / "python"
        # Validate the interpreter before pip can touch an existing environment.
        version = subprocess.check_output([str(venv_python), "-I", "-c", "import sys; print(*sys.version_info[:2])"], text=True).strip()
        if version != "3 11":
            raise LocalError("Existing .venv is not Python 3.11. Use a clean dedicated environment")
        pip_install(venv_python, lock)
        atomic_json(RUNTIME, {"venv": str(directory), "lock": str(lock), "lockSha256": hashlib.sha256(lock.read_bytes()).hexdigest()})
    print(f"Installed LibreTranslate {VERSION} in {directory}; system Python is unchanged.")
    if not args.skip_models:
        install_models(args)


MODEL_INSTALL_CODE = r'''
import hashlib,json,os,sys,uuid
from argostranslate import package
from argostranslate.sbd import MiniSBDSentencizer
from minisbd import download_models
from libretranslate.language import iso2model
selection=json.loads(sys.argv[1])
lock=json.loads(sys.argv[2])
pinned=lock['packages']
codes=iso2model(selection)
package.update_package_index()
available=package.get_available_packages()
installed=package.get_installed_packages()
wanted=[]
for target in codes:
    if target == 'en': continue
    for source,destination in [('en',target),(target,'en')]:
        candidates=[p for p in available if p.from_code==source and p.to_code==destination]
        required=next((p for p in pinned if p['source']==source and p['target']==destination),None)
        if required is None or not required.get('sha256'):
            raise SystemExit('No reviewed model pin for %s -> %s; extend models.lock.json after availability review.'%(source,destination))
        candidates=[p for p in candidates if str(p.package_version)==required['version']]
        if not candidates: raise SystemExit('No installed/downloadable direct model for %s -> %s; use a manual catalog.'%(source,destination))
        wanted.append(candidates[-1])
# Validate every requested direction before downloading anything.
for model in wanted:
    existing=next((p for p in installed if p.from_code==model.from_code and p.to_code==model.to_code),None)
    required=next((p for p in pinned if p['source']==model.from_code and p['target']==model.to_code),None)
    archive=model.download()
    digest=hashlib.sha256(archive.read_bytes()).hexdigest()
    if required is not None and required.get('sha256')!=digest:
        raise SystemExit('Model archive SHA256 differs from reviewed model lock: %s -> %s'%(model.from_code,model.to_code))
    if existing is not None:
        if str(existing.package_version)!=str(model.package_version):
            raise SystemExit('Installed model version differs; archive models before an explicit model upgrade.')
        continue
    print('Installing %s -> %s version %s'%(model.from_code,model.to_code,model.package_version),flush=True)
    package.install_from_path(archive)
from minisbd import models as sentence_models
sentence_codes=list(dict.fromkeys(MiniSBDSentencizer.LANGUAGE_CODE_MAPPING.get(code,code) for code in codes))
sentence_codes=[code if code in sentence_models.list_models() else 'en' for code in sentence_codes]
for code in sentence_codes:
    if not any(entry['code']==code for entry in lock['sentenceModels']):
        raise SystemExit('No reviewed sentence model pin for '+code)
download_models(sentence_codes,print)
for code in sentence_codes:
    required=next((entry for entry in lock['sentenceModels'] if entry['code']==code),None)
    filename=sentence_models.get_model_file(code)
    from pathlib import Path
    digest=hashlib.sha256(Path(filename).read_bytes()).hexdigest()
    if required is not None and required['sha256']!=digest:
        raise SystemExit('Sentence model SHA256 differs from reviewed model lock: '+code)
actual=[{'source':p.from_code,'target':p.to_code,'version':str(p.package_version)} for p in package.get_installed_packages()]
from pathlib import Path
destination=Path(sys.argv[3])
temporary=destination.with_name(destination.name+'.'+uuid.uuid4().hex+'.tmp')
temporary.write_text(json.dumps({'languages':selection,'sentenceModels':sentence_codes,'packages':actual},indent=2)+'\n')
temporary.chmod(0o600)
os.replace(temporary,destination)
'''


def install_models(args):
    selected = languages(args.languages)
    python = active_python()
    validate_environment(python)
    pinned = read_json(ROOT / "models.lock.json")
    with lifecycle_lock():
        if owned_process(read_json(PID_FILE)):
            raise LocalError("Stop the service before changing models")
        run_in_environment(python, MODEL_INSTALL_CODE, json.dumps(selected), json.dumps(pinned), str(STATE / "models.json"))
        assert_installed_models(python, selected)
    print("Persistent model installation complete: " + ",".join(selected))


def assert_installed_models(python, selected):
    run_in_environment(python, r'''
import hashlib,json,sys,zipfile
from pathlib import Path,PurePosixPath
from argostranslate import package,settings
from argostranslate.sbd import MiniSBDSentencizer
from libretranslate.language import iso2model
from minisbd import models as sentence_models
codes=iso2model(json.loads(sys.argv[1]))
lock=json.loads(sys.argv[2])
installed=package.get_installed_packages()
pairs={(p.from_code,p.to_code) for p in installed}
required={(s,t) for code in codes if code!='en' for s,t in [('en',code),(code,'en')]}
missing=required-pairs
if missing: raise SystemExit('Missing models %s; run install-models.sh before start.'%sorted(missing))
def digest(handle):
    value=hashlib.sha256()
    for chunk in iter(lambda:handle.read(1024*1024),b''): value.update(chunk)
    return value.hexdigest()
for source,target in required:
    model=next(p for p in installed if p.from_code==source and p.to_code==target)
    pin=next((p for p in lock['packages'] if p['source']==source and p['target']==target),None)
    if pin is None or str(model.package_version)!=pin['version']:
        raise SystemExit('Installed model version has no reviewed pin: %s -> %s'%(source,target))
    archive=settings.downloads_dir/('translate-%s_%s.argosmodel'%(source,target))
    if not archive.is_file(): raise SystemExit('Model archive missing; run install-models.sh: '+str(archive))
    with archive.open('rb') as handle:
        if digest(handle)!=pin['sha256']: raise SystemExit('Model archive SHA256 mismatch: '+str(archive))
    with zipfile.ZipFile(archive) as bundle:
        for entry in bundle.infolist():
            if entry.is_dir(): continue
            relative=Path(*PurePosixPath(entry.filename).parts[1:])
            installed_file=Path(model.package_path)/relative
            if not installed_file.is_file(): raise SystemExit('Installed model file missing: '+str(installed_file))
            with installed_file.open('rb') as actual,bundle.open(entry) as expected:
                if digest(actual)!=digest(expected): raise SystemExit('Installed model file changed: '+str(installed_file))
for code in codes:
    sentence=MiniSBDSentencizer.LANGUAGE_CODE_MAPPING.get(code,code)
    if sentence not in sentence_models.list_models(): sentence='en'
    pin=next((p for p in lock['sentenceModels'] if p['code']==sentence),None)
    path=Path(sentence_models.cache_dir)/sentence_models.MODELS[sentence]
    if pin is None or not path.is_file(): raise SystemExit('Missing reviewed sentence model '+sentence+'; run install-models.sh')
    with path.open('rb') as handle:
        if digest(handle)!=pin['sha256']: raise SystemExit('Sentence model SHA256 mismatch: '+sentence)
''', json.dumps(selected), json.dumps(read_json(ROOT / "models.lock.json")))


def api_json(port, path, body=None, timeout=10):
    url = f"http://{HOST}:{port}{path}"
    request = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                     headers={"Content-Type": "application/json"} if body is not None else {})
    # Local service requests must never follow a system proxy or an HTTP redirect.
    class RejectRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, request, fp, code, msg, headers, newurl):
            raise LocalError("Native translation service unexpectedly redirected a local request")
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), RejectRedirect())
    with opener.open(request, timeout=timeout) as response:
        return json.load(response)


def healthy(port, selected):
    health = api_json(port, "/health", timeout=3)
    available = api_json(port, "/languages", timeout=3)
    if not isinstance(health, dict) or health.get("status") != "ok":
        raise LocalError("Native service health did not report status ok")
    if not isinstance(available, list):
        raise LocalError("Native service returned malformed language capabilities")
    pairs = {entry["code"]: entry.get("targets", []) for entry in available if isinstance(entry, dict) and "code" in entry}
    if any(code not in pairs or code not in pairs.get("en", []) or "en" not in pairs[code] for code in selected):
        raise LocalError("Native service has not loaded the requested English source/target model pairs")
    return available


def stop_record(record, timeout):
    if not owned_process(record):
        return False
    os.kill(record["pid"], signal.SIGTERM)
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if not owned_process(record):
            return True
        time.sleep(0.2)
    raise LocalError("Native service did not stop gracefully; PID state was retained. No forced kill was sent.")


def start(args):
    port = integer(args.port or os.environ.get("LT_PORT", DEFAULT_PORT), "Port")
    selected = languages(args.languages)
    timeout = integer(args.timeout or os.environ.get("LT_START_TIMEOUT", 120), "Startup timeout", 1, 600)
    python = active_python()
    validate_environment(python)
    with lifecycle_lock():
        previous = read_json(PID_FILE)
        if owned_process(previous):
            if previous.get("port") != port or previous.get("languages") != selected:
                raise LocalError("A native service is already running with another configuration. Stop it before changing ports or languages.")
            healthy(port, selected)
            print(f"Native LibreTranslate already running: http://{HOST}:{port} (PID {previous['pid']})")
            return
        PID_FILE.unlink(missing_ok=True)
        assert_port_available(port)
        assert_installed_models(python, selected)
        token = uuid.uuid4().hex
        command = [str(python), str(SCRIPT), "serve", "--token", token, "--port", str(port), "--languages", ",".join(selected)]
        if args.foreground:
            print(f"Serving native LibreTranslate on http://{HOST}:{port} in the foreground", flush=True)
            command.append("--foreground-owner")
            # serve records ownership after exec, before accepting requests.
            os.execve(str(python), command, clean_environment())
        logfile = STATE / "logs" / "service.log"
        env = clean_environment()
        # Bound retained logs across starts; serve suppresses upstream input logs.
        if logfile.exists() and logfile.stat().st_size > 10 * 1024 * 1024:
            logfile.replace(logfile.with_suffix(".log.previous"))
        with logfile.open("ab") as log:
            process = subprocess.Popen(command, cwd=ROOT, env=env, stdin=subprocess.DEVNULL,
                                       stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        snapshot = None
        for _ in range(25):
            snapshot = process_snapshot(process.pid)
            if snapshot:
                break
            time.sleep(0.02)
        if snapshot is None:
            raise LocalError(f"Native service exited immediately. Inspect {logfile}")
        record = {"pid": process.pid, "token": token, "port": port, "languages": selected, **snapshot}
        atomic_json(PID_FILE, record)
        deadline = time.monotonic() + timeout
        last_error = "service not ready"
        while time.monotonic() < deadline:
            if process.poll() is not None:
                PID_FILE.unlink(missing_ok=True)
                raise LocalError(f"Native LibreTranslate exited with status {process.returncode}. Inspect {logfile}")
            try:
                healthy(port, selected)
                if not owned_process(record):
                    raise LocalError("Native process identity changed during startup")
                print(f"Native LibreTranslate ready: http://{HOST}:{port} (PID {process.pid})\nLog: {logfile}")
                return
            except (urllib.error.URLError, OSError, ValueError, LocalError) as exc:
                last_error = str(exc)
                time.sleep(0.5)
        stop_record(record, 15)
        PID_FILE.unlink(missing_ok=True)
        raise LocalError(f"Native startup timed out ({last_error}). Inspect {logfile}")


def serve(args):
    if sys.prefix == sys.base_prefix:
        raise LocalError("LibreTranslate may only run inside the dedicated venv")
    selected = languages(args.languages)
    port = integer(args.port, "Port")
    if args.foreground_owner:
        with lifecycle_lock():
            previous = read_json(PID_FILE)
            if owned_process(previous) and previous["pid"] != os.getpid():
                raise LocalError("Another project-owned native service is running")
            snapshot = process_snapshot(os.getpid())
            if snapshot is None:
                raise LocalError("Cannot record foreground process ownership")
            atomic_json(PID_FILE, {"pid": os.getpid(), "token": args.token, "port": port, "languages": selected, **snapshot})
    # Actual flags are defined by LibreTranslate 1.9.6 main.py. No debug/reloader.
    sys.argv = ["libretranslate", "--host", HOST, "--port", str(port), "--load-only", ",".join(selected),
                "--threads", "1", "--char-limit", "5000", "--batch-limit", "20",
                "--disable-files-translation", "--disable-web-ui", "--translation-cache", "all"]
    import argostranslate.sbd
    import minisbd.models
    import logging
    logging.getLogger("argostranslate.utils").setLevel(logging.WARNING)
    minisbd.models.cache_dir = str(STATE / "cache" / "minisbd")
    from libretranslate.main import main
    main()


def stop(args):
    with lifecycle_lock():
        record = read_json(PID_FILE)
        if not owned_process(record):
            PID_FILE.unlink(missing_ok=True)
            print("No project-owned native LibreTranslate process is running. Other processes were left unchanged.")
            return
        stop_record(record, integer(args.timeout or 30, "Stop timeout", 1, 120))
        PID_FILE.unlink(missing_ok=True)
    print("Native LibreTranslate stopped gracefully; persistent models and caches were retained.")


def verify(args):
    python = active_python()
    metadata = validate_environment(python)
    port = integer(args.port or os.environ.get("LT_PORT", DEFAULT_PORT), "Port")
    selected = languages(args.languages)
    assert_installed_models(python, selected)
    available = healthy(port, selected)
    target = args.target or next(code for code in selected if code != "en")
    if target not in selected:
        raise LocalError("Verification target must be in the selected installed languages")
    response = api_json(port, "/translate", {"q": "Hello world!", "source": "en", "target": target, "format": "text"}, timeout=60)
    translated = response.get("translatedText") if isinstance(response, dict) else None
    if not isinstance(translated, str) or not translated.strip() or translated == "Hello world!":
        raise LocalError("Real translation returned empty or unchanged source text")
    print(json.dumps({"endpoint": f"http://{HOST}:{port}", "virtualEnvironment": str(python.parent.parent),
                      "python": ".".join(map(str, metadata["python"])), "libretranslate": metadata["version"],
                      "languages": available, "translation": {"source": "en", "target": target, "input": "Hello world!", "output": translated}}, indent=2, ensure_ascii=False))


def update(args):
    if args.rollback:
        with lifecycle_lock():
            current = read_json(RUNTIME, {})
            previous = current.get("previous")
            if not isinstance(previous, dict) or not previous.get("venv"):
                raise LocalError("No previous verified environment is recorded")
            directory = checked_venv_directory(previous["venv"])
            validate_environment(directory / "bin" / "python")
            assert_installed_models(directory / "bin" / "python", languages(args.languages))
            atomic_json(RUNTIME, {**previous, "previous": {key: value for key, value in current.items() if key != "previous"}})
        print("Previous verified native environment selected. Stop/start to activate it; the running service was left unchanged.")
        return
    lock = checked_lock(args.lock)
    base_python = checked_python(args.python)
    digest = hashlib.sha256(lock.read_bytes()).hexdigest()
    directory = checked_venv_directory(ROOT / ".venvs" / (digest[:12] + "-" + uuid.uuid4().hex[:8]))
    with lifecycle_lock():
        previous = read_json(RUNTIME, {"venv": str(ROOT / ".venv")})
        directory.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([str(base_python), "-I", "-m", "venv", str(directory)], check=True)
        python = directory / "bin" / "python"
        pip_install(python, lock)
        # Exercise native libraries and the actual translation model before switch.
        selected = languages(args.languages)
        assert_installed_models(python, selected)
        run_in_environment(python, "from argostranslate import translate; import sys; result=translate.translate('Hello world!','en',sys.argv[1]); assert result and result!='Hello world!'; print(result)", next(code for code in selected if code != "en"))
        atomic_json(RUNTIME, {"venv": str(directory), "lock": str(lock), "lockSha256": digest, "previous": previous})
    print(f"Verified staged dependencies in {directory}. Existing service keeps its current environment until stop/start.\nPrevious environment and persistent models were retained for rollback.")


def parser():
    result = argparse.ArgumentParser(description=__doc__)
    commands = result.add_subparsers(dest="command", required=True)
    for name, function in (("install", install), ("models", install_models), ("start", start), ("stop", stop), ("verify", verify), ("update", update), ("serve", serve)):
        command = commands.add_parser(name)
        command.set_defaults(function=function)
        if name in ("install", "update"):
            command.add_argument("--python", help="Installed CPython 3.11 executable (or set LT_PYTHON)")
            command.add_argument("--lock", help="Reviewed, fully pinned CPython 3.11 dependency lock")
        if name in ("install", "models", "start", "verify", "update", "serve"):
            command.add_argument("--languages", help="Explicit installed model languages; default en,bn")
        if name in ("start", "verify", "serve"):
            command.add_argument("--port", help="Loopback port; default 5001 or LT_PORT")
        if name in ("start", "stop"):
            command.add_argument("--timeout", help="Readiness or graceful stop timeout in seconds")
        if name == "install":
            command.add_argument("--skip-models", action="store_true", help="Install dependencies without downloading language models")
        if name == "start":
            command.add_argument("--foreground", action="store_true", help="Run directly under a process supervisor")
        if name == "verify":
            command.add_argument("--target", help="Selected language for the real translation smoke check")
        if name == "update":
            command.add_argument("--rollback", action="store_true", help="Select the previous verified environment; restart explicitly")
        if name == "serve":
            command.add_argument("--token", required=True)
            command.add_argument("--foreground-owner", action="store_true")
    return result


def main():
    args = parser().parse_args()
    try:
        args.function(args)
    except (LocalError, subprocess.CalledProcessError, urllib.error.URLError, OSError, ValueError) as exc:
        print(f"Native LibreTranslate: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
