import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteUploadFileViaSSH,
  usesSSHUploadStorage,
  writeUploadFileViaSSH,
} from "@/lib/services/upload-ssh.storage";

const mockSpawn = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

const ROOT = "/var/www/uploads/bangbuy";
const FILENAME = "mgoe4ftp-0123456789abcdef01234567.webp";
const UNAVAILABLE = "Upload storage is unavailable. Please try again later.";

class SSHProcess extends EventEmitter {
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
  kill = vi.fn().mockReturnValue(true);
  request: Buffer[] = [];

  constructor() {
    super();
    this.stdin.on("data", (chunk: Buffer) => this.request.push(chunk));
  }

  respond(payload: unknown, code = 0) {
    this.stdout.write(`${JSON.stringify(payload)}\n`);
    this.emit("close", code, null);
  }

  packet() {
    const buffer = Buffer.concat(this.request);
    const newline = buffer.indexOf(0x0a);
    return {
      header: JSON.parse(buffer.subarray(0, newline).toString("utf8")),
      data: buffer.subarray(newline + 1),
    };
  }
}

let child: SSHProcess;

beforeEach(() => {
  vi.stubEnv("UPLOAD_STORAGE", "ssh");
  vi.stubEnv("UPLOAD_SSH_HOST", "192.0.2.10");
  vi.stubEnv("UPLOAD_SSH_USER", "bangbuy-upload");
  vi.stubEnv("UPLOAD_SSH_KEY", "/tmp/upload-test-key");
  vi.stubEnv("UPLOAD_SSH_PORT", "22");
  vi.spyOn(console, "error").mockImplementation(() => {});
  child = new SSHProcess();
  mockSpawn.mockReset().mockReturnValue(child);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("SSH upload storage", () => {
  it("sends binary data and metadata through stdin without a remote shell command", async () => {
    const data = Buffer.from([0, 255, 10, 34, 39, 36, 96]);
    const request = writeUploadFileViaSSH(ROOT, "products", FILENAME, data);

    expect(child.packet()).toEqual({
      header: { action: "write", root: ROOT, category: "products", filename: FILENAME, size: data.length },
      data,
    });
    const [executable, args, options] = mockSpawn.mock.calls[0];
    expect(executable).toBe("ssh");
    expect(options.shell).toBe(false);
    expect(args.at(-1)).toBe("bangbuy-upload@192.0.2.10");
    expect(args).toContain("BatchMode=yes");
    expect(args).toContain("IdentitiesOnly=yes");
    expect(args).toContain("StrictHostKeyChecking=yes");
    expect(args).not.toContain(ROOT);
    expect(args).not.toContain(FILENAME);

    child.respond({ success: true });
    await request;
  });

  it.each([true, false])("returns the VPS deletion result %s without sending image data", async (deleted) => {
    const request = deleteUploadFileViaSSH(ROOT, "products", FILENAME);
    expect(child.packet()).toEqual({
      header: { action: "delete", root: ROOT, category: "products", filename: FILENAME },
      data: Buffer.alloc(0),
    });
    child.respond({ success: true, deleted });
    await expect(request).resolves.toBe(deleted);
  });

  it("uses filesystem storage unless SSH is explicitly selected", () => {
    vi.stubEnv("UPLOAD_STORAGE", undefined);
    expect(usesSSHUploadStorage()).toBe(false);
    vi.stubEnv("UPLOAD_STORAGE", "filesystem");
    expect(usesSSHUploadStorage()).toBe(false);
    vi.stubEnv("UPLOAD_STORAGE", "ssh");
    expect(usesSSHUploadStorage()).toBe(true);
  });

  it.each(["UPLOAD_SSH_HOST", "UPLOAD_SSH_USER", "UPLOAD_SSH_KEY"])(
    "rejects missing %s before starting SSH", async (name) => {
      vi.stubEnv(name, undefined);
      await expect(writeUploadFileViaSSH(ROOT, "products", FILENAME, Buffer.from("image")))
        .rejects.toMatchObject({ status: 500, message: UNAVAILABLE });
      expect(mockSpawn).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["UPLOAD_SSH_HOST", "-oProxyCommand=malicious"],
    ["UPLOAD_SSH_HOST", "host; touch /tmp/injected"],
    ["UPLOAD_SSH_USER", "root@untrusted"],
    ["UPLOAD_SSH_USER", "-oProxyCommand=malicious"],
    ["UPLOAD_SSH_PORT", "22 -oProxyCommand=malicious"],
    ["UPLOAD_SSH_PORT", "0"],
    ["UPLOAD_SSH_PORT", "65536"],
  ])("rejects unsafe SSH destination configuration %s=%s", async (name, value) => {
    vi.stubEnv(name, value);
    await expect(writeUploadFileViaSSH(ROOT, "products", FILENAME, Buffer.from("image")))
      .rejects.toThrow(UNAVAILABLE);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it.each([
    ["relative-root", "products", FILENAME],
    [ROOT, "../products", FILENAME],
    [ROOT, "products", "../secret.webp"],
    [ROOT, "products", `${FILENAME}; touch /tmp/injected`],
  ])("rejects unsafe storage paths before connecting", async (root, category, filename) => {
    await expect(writeUploadFileViaSSH(root, category, filename, Buffer.from("image")))
      .rejects.toThrow(UNAVAILABLE);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it("reports an authentication failure without exposing its diagnostic to the UI", async () => {
    const request = writeUploadFileViaSSH(ROOT, "products", FILENAME, Buffer.from("image"));
    child.stderr.write("Permission denied (publickey).");
    child.emit("close", 255, null);
    await expect(request).rejects.toMatchObject({ status: 500, message: UNAVAILABLE });
    expect(console.error).toHaveBeenCalledWith("[upload.ssh] storage failed", expect.stringContaining("Permission denied"));
  });

  it("keeps helper storage diagnostics in server logs while returning the safe UI message", async () => {
    const request = writeUploadFileViaSSH(ROOT, "products", FILENAME, Buffer.from("image"));
    child.respond({ success: false, error: "Configured upload root does not match the server." }, 1);
    await expect(request).rejects.toThrow(UNAVAILABLE);
    expect(console.error).toHaveBeenCalledWith("[upload.ssh] storage failed", expect.stringContaining("Configured upload root"));
  });

  it("handles an unavailable SSH executable", async () => {
    const request = writeUploadFileViaSSH(ROOT, "products", FILENAME, Buffer.from("image"));
    child.emit("error", new Error("spawn ssh ENOENT"));
    await expect(request).rejects.toThrow(UNAVAILABLE);
    expect(child.kill).toHaveBeenCalled();
  });

  it("handles a closed stdin without an unhandled stream error", async () => {
    const request = writeUploadFileViaSSH(ROOT, "products", FILENAME, Buffer.from("image"));
    child.stdin.emit("error", new Error("write EPIPE"));
    await expect(request).rejects.toThrow(UNAVAILABLE);
    expect(child.kill).toHaveBeenCalled();
  });

  it.each([
    { success: false, error: "Storage permission denied." },
    { success: true },
    { success: true, deleted: "true" },
  ])("requires an explicit valid deletion acknowledgement", async (response) => {
    const request = deleteUploadFileViaSSH(ROOT, "products", FILENAME);
    child.respond(response);
    await expect(request).rejects.toThrow(UNAVAILABLE);
  });

  it("rejects malformed response JSON", async () => {
    const request = writeUploadFileViaSSH(ROOT, "products", FILENAME, Buffer.from("image"));
    child.stdout.write("SSH login banner\n");
    child.emit("close", 0, null);
    await expect(request).rejects.toThrow(UNAVAILABLE);
  });

  it.each(["stdout", "stderr"] as const)("limits %s output and terminates the process", async (stream) => {
    const request = writeUploadFileViaSSH(ROOT, "products", FILENAME, Buffer.from("image"));
    child[stream].write(Buffer.alloc(8 * 1024 + 1));
    await expect(request).rejects.toThrow(UNAVAILABLE);
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  });

  it("terminates a stalled connection after thirty seconds", async () => {
    vi.useFakeTimers();
    const request = writeUploadFileViaSSH(ROOT, "products", FILENAME, Buffer.from("image"));
    const rejected = expect(request).rejects.toThrow(UNAVAILABLE);
    await vi.advanceTimersByTimeAsync(30_000);
    await rejected;
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  });
});
