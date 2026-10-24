"""Exercise the actual restricted SSH helper against a temporary filesystem."""

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

HELPER = Path(__file__).resolve().parents[1] / "upload-storage.py"
FILENAME = "muwez35d-a4b73322640fec3e87624334.webp"


class UploadStorageTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / "uploads"
        self.root.mkdir()

    def call(self, action="write", data=b"image", **changes):
        request = {"action": action, "category": "other", "filename": FILENAME,
                   "root": str(self.root), "size": len(data)}
        request.update(changes)
        process = subprocess.run(
            [sys.executable, str(HELPER), "--root", str(self.root)],
            input=json.dumps(request).encode() + b"\n" + data,
            capture_output=True, timeout=5,
        )
        return process, json.loads(process.stdout)

    def test_upload_is_publicly_readable_and_delete_is_idempotent(self):
        process, result = self.call()
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertTrue(result["success"])
        path = self.root / "other" / FILENAME
        self.assertEqual(path.read_bytes(), b"image")
        self.assertEqual(path.stat().st_mode & 0o777, 0o644)
        self.assertEqual(self.call("delete", data=b"")[1], {"success": True, "deleted": True})
        self.assertFalse(path.exists())
        self.assertEqual(self.call("delete", data=b"")[1], {"success": True, "deleted": False})

    def test_rejects_traversal_and_wrong_root(self):
        for changes in ({"category": "../escape"}, {"filename": "../../outside.webp"},
                        {"root": str(self.root.parent)}):
            with self.subTest(changes=changes):
                process, result = self.call(**changes)
                self.assertEqual(process.returncode, 1)
                self.assertFalse(result["success"])
        self.assertEqual(list(self.root.iterdir()), [])

    def test_rejects_category_symlink(self):
        outside = self.root.parent / "outside"
        outside.mkdir()
        (self.root / "other").symlink_to(outside, target_is_directory=True)
        process, result = self.call()
        self.assertEqual(process.returncode, 1)
        self.assertFalse(result["success"])
        self.assertEqual(list(outside.iterdir()), [])

    def test_incomplete_or_extra_body_leaves_no_file(self):
        for size in (3, 10):
            with self.subTest(size=size):
                process, result = self.call(size=size)
                self.assertEqual(process.returncode, 1)
                self.assertFalse(result["success"])
                self.assertEqual(list((self.root / "other").iterdir()), [])

    def test_existing_file_is_never_overwritten(self):
        self.call(data=b"original")
        process, result = self.call(data=b"replacement")
        self.assertEqual(process.returncode, 1)
        self.assertFalse(result["success"])
        self.assertEqual((self.root / "other" / FILENAME).read_bytes(), b"original")
        self.assertEqual(len(list((self.root / "other").iterdir())), 1)

    def test_cannot_delete_symlink_target(self):
        outside = self.root.parent / "outside.webp"
        outside.write_bytes(b"keep")
        (self.root / "other").mkdir()
        (self.root / "other" / FILENAME).symlink_to(outside)
        process, result = self.call("delete", data=b"")
        self.assertEqual(process.returncode, 1)
        self.assertFalse(result["success"])
        self.assertEqual(outside.read_bytes(), b"keep")

    def test_oversized_declaration_is_rejected_before_write(self):
        process, result = self.call(size=32 * 1024 * 1024 + 1)
        self.assertEqual(process.returncode, 1)
        self.assertFalse(result["success"])
        self.assertEqual(list(self.root.iterdir()), [])

    def test_stalled_input_times_out_and_removes_partial_file(self):
        request = {"action": "write", "category": "other", "filename": FILENAME,
                   "root": str(self.root), "size": 10}
        process = subprocess.Popen(
            [sys.executable, str(HELPER), "--root", str(self.root), "--timeout", "1"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        try:
            process.stdin.write(json.dumps(request).encode() + b"\npartial")
            process.stdin.flush()
            self.assertEqual(process.wait(timeout=5), 1)
            self.assertFalse(json.loads(process.stdout.read())["success"])
            self.assertEqual(list((self.root / "other").iterdir()), [])
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()
            process.stdin.close()
            process.stdout.close()
            process.stderr.close()


if __name__ == "__main__":
    unittest.main()
