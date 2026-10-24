#!/usr/bin/env python3
"""Restricted SSH upload command. Never accepts a client-provided shell command."""

import argparse
import json
import os
from pathlib import Path
import re
import secrets
import signal
import stat
import sys

MAX_BYTES = 32 * 1024 * 1024
CATEGORIES = {"products", "categories", "users", "banners", "other"}
FILENAME = re.compile(r"[a-z0-9]+-[a-f0-9]{24}\.(?:webp|gif)\Z")


def execute(root: Path, stream) -> dict:
    header = stream.readline(4097)
    if len(header) > 4096 or not header.endswith(b"\n"):
        raise ValueError("Invalid upload header")
    request = json.loads(header)
    if not isinstance(request, dict):
        raise ValueError("Invalid upload request")
    if request.get("action") not in {"write", "delete"}:
        raise ValueError("Invalid upload action")
    category = request.get("category")
    filename = request.get("filename")
    if not isinstance(category, str) or category not in CATEGORIES:
        raise ValueError("Invalid upload category")
    if not isinstance(filename, str) or not FILENAME.fullmatch(filename):
        raise ValueError("Invalid upload filename")
    if request.get("root") != str(root):
        raise ValueError("Upload root does not match server configuration")

    size = request.get("size")
    if request["action"] == "write" and (
        type(size) is not int or size <= 0 or size > MAX_BYTES
    ):
        raise ValueError("Invalid upload size")

    # Directory descriptors and O_NOFOLLOW prevent category symlinks from
    # redirecting writes/deletions outside the upload tree.
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    root_fd = os.open(root, flags)
    category_fd = None
    temporary = None
    try:
        if request["action"] == "write":
            try:
                os.mkdir(category, mode=0o755, dir_fd=root_fd)
            except FileExistsError:
                pass
        try:
            category_fd = os.open(category, flags, dir_fd=root_fd)
        except FileNotFoundError:
            if request["action"] == "delete":
                return {"success": True, "deleted": False}
            raise

        if request["action"] == "delete":
            if stream.read(1):
                raise ValueError("Unexpected delete payload")
            try:
                info = os.stat(filename, dir_fd=category_fd, follow_symlinks=False)
                if not stat.S_ISREG(info.st_mode):
                    raise ValueError("Upload is not a regular file")
                os.unlink(filename, dir_fd=category_fd)
            except FileNotFoundError:
                return {"success": True, "deleted": False}
            return {"success": True, "deleted": True}

        temporary = f".{filename}.{secrets.token_hex(8)}.part"
        fd = os.open(
            temporary,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
            0o600,
            dir_fd=category_fd,
        )
        with os.fdopen(fd, "wb") as output:
            remaining = size
            while remaining:
                chunk = stream.read(min(remaining, 64 * 1024))
                if not chunk:
                    raise ValueError("Incomplete upload payload")
                output.write(chunk)
                remaining -= len(chunk)
            if stream.read(1):
                raise ValueError("Upload payload exceeds declared size")
            output.flush()
            os.fsync(output.fileno())
            os.fchmod(output.fileno(), 0o644)

        # Linking the complete temporary file is atomic and fails if the
        # destination already exists. Readers never see a partial image.
        os.link(
            temporary,
            filename,
            src_dir_fd=category_fd,
            dst_dir_fd=category_fd,
            follow_symlinks=False,
        )
        return {"success": True}
    finally:
        if temporary is not None and category_fd is not None:
            try:
                os.unlink(temporary, dir_fd=category_fd)
            except FileNotFoundError:
                pass
        if category_fd is not None:
            os.close(category_fd)
        os.close(root_fd)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default="/var/www/uploads/sextoy")
    parser.add_argument("--timeout", type=int, default=40)
    args = parser.parse_args()
    root = Path(os.path.abspath(args.root))

    def timed_out(_signal, _frame):
        raise TimeoutError("Upload storage request timed out")

    signal.signal(signal.SIGALRM, timed_out)
    signal.alarm(max(1, args.timeout))
    try:
        result = execute(root, sys.stdin.buffer)
        print(json.dumps(result), flush=True)
        return 0
    except Exception as error:
        print(f"Upload storage: {type(error).__name__}: {error}", file=sys.stderr)
        print(json.dumps({"success": False, "error": "Upload storage is unavailable. Please try again later."}), flush=True)
        return 1
    finally:
        signal.alarm(0)


if __name__ == "__main__":
    sys.exit(main())
