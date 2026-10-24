import "server-only";

import { spawn } from "node:child_process";
import { isIP } from "node:net";
import { isAbsolute } from "node:path";

import { ServiceError } from "@/lib/services/service-error";

const STORAGE_UNAVAILABLE =
  "Upload storage is unavailable. Please try again later.";
const COMMAND_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 8 * 1024;
const MAX_STORED_BYTES = 32 * 1024 * 1024;
const VALID_CATEGORIES = new Set([
  "products", "categories", "users", "banners", "other",
]);
const GENERATED_FILENAME = /^[a-z0-9]+-[a-f0-9]{24}\.(webp|gif)$/;

type StorageRequest = {
  action: "write" | "delete";
  category: string;
  filename: string;
  root: string;
  size?: number;
};

type StorageResponse = { success: true; deleted?: boolean };

export function usesSSHUploadStorage(): boolean {
  return process.env.UPLOAD_STORAGE === "ssh";
}

function sshArguments(): string[] {
  const host = process.env.UPLOAD_SSH_HOST;
  const user = process.env.UPLOAD_SSH_USER;
  const key = process.env.UPLOAD_SSH_KEY;
  const port = process.env.UPLOAD_SSH_PORT ?? "22";

  if (!host || !user || !key) {
    throw new Error("SSH upload host, user, and private key must be configured.");
  }
  if (
    host.length > 253 ||
    (!isIP(host) && !/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(host))
  ) {
    throw new Error("Invalid SSH upload host.");
  }
  if (!/^[a-z_][a-z0-9_-]*$/.test(user)) {
    throw new Error("Invalid SSH upload user.");
  }
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65_535) {
    throw new Error("Invalid SSH upload port.");
  }

  // The key is constrained to the VPS upload helper. All request values travel
  // on stdin; no path, filename, or remote shell command is interpolated here.
  return [
    "-T",
    "-o", "BatchMode=yes",
    "-o", "IdentitiesOnly=yes",
    "-o", "StrictHostKeyChecking=yes",
    "-o", "ConnectTimeout=10",
    "-i", key,
    "-p", port,
    `${user}@${host}`,
  ];
}

async function sendStorageRequest(
  request: StorageRequest,
  data?: Buffer,
): Promise<StorageResponse> {
  try {
    if (
      !isAbsolute(request.root) ||
      !VALID_CATEGORIES.has(request.category) ||
      !GENERATED_FILENAME.test(request.filename)
    ) {
      throw new Error("Invalid SSH upload path.");
    }
    if (data && (data.length === 0 || data.length > MAX_STORED_BYTES)) {
      throw new Error("SSH upload data exceeds the storage limit.");
    }
    const args = sshArguments();

    return await new Promise<StorageResponse>((resolve, reject) => {
      const child = spawn("ssh", args, {
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      });
      let settled = false;
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;

      const finish = (error?: Error, response?: StorageResponse, kill = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (kill) child.kill("SIGKILL");
        if (error) reject(error);
        else resolve(response!);
      };

      const timeout = setTimeout(() => {
        finish(new Error("SSH upload storage command timed out."), undefined, true);
      }, COMMAND_TIMEOUT_MS);

      child.once("error", (error) => finish(error, undefined, true));
      child.stdin.once("error", (error) => finish(error, undefined, true));
      child.stdout.on("data", (chunk: Buffer) => {
        if (settled) return;
        stdoutBytes += chunk.length;
        if (stdoutBytes > MAX_RESPONSE_BYTES) {
          finish(new Error("SSH upload response was too large."), undefined, true);
          return;
        }
        stdout.push(chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        if (settled) return;
        stderrBytes += chunk.length;
        if (stderrBytes > MAX_RESPONSE_BYTES) {
          finish(new Error("SSH upload diagnostic output was too large."), undefined, true);
          return;
        }
        stderr.push(chunk);
      });
      child.once("close", (code, signal) => {
        if (settled) return;
        if (code !== 0) {
          let diagnostic = Buffer.concat(stderr).toString("utf8").trim();
          if (!diagnostic) {
            try {
              const response: unknown = JSON.parse(Buffer.concat(stdout).toString("utf8"));
              if (response && typeof response === "object" && "error" in response && typeof response.error === "string") {
                diagnostic = response.error;
              }
            } catch {
              // SSH can fail before the helper returns its JSON response.
            }
          }
          finish(new Error(
            `SSH upload storage failed (${code ?? signal ?? "unknown"})${diagnostic ? `: ${diagnostic}` : ""}`,
          ));
          return;
        }
        try {
          const response: unknown = JSON.parse(Buffer.concat(stdout).toString("utf8"));
          if (
            !response || typeof response !== "object" ||
            !("success" in response) || response.success !== true ||
            (request.action === "delete" &&
              (!("deleted" in response) || typeof response.deleted !== "boolean"))
          ) {
            throw new Error("SSH upload storage returned an invalid acknowledgement.");
          }
          finish(undefined, response as StorageResponse);
        } catch (error) {
          finish(error instanceof Error ? error : new Error("Invalid SSH upload response."));
        }
      });

      const header = Buffer.from(`${JSON.stringify(request)}\n`);
      try {
        child.stdin.end(data ? Buffer.concat([header, data]) : header);
      } catch (error) {
        finish(error instanceof Error ? error : new Error("SSH upload stdin failed."), undefined, true);
      }
    });
  } catch (error) {
    // Keep infrastructure details in server logs, never in the browser error.
    console.error("[upload.ssh] storage failed", error instanceof Error ? error.message : "Unknown error");
    throw new ServiceError(500, STORAGE_UNAVAILABLE);
  }
}

export async function writeUploadFileViaSSH(
  root: string,
  category: string,
  filename: string,
  data: Buffer,
): Promise<void> {
  await sendStorageRequest({ action: "write", root, category, filename, size: data.length }, data);
}

export async function deleteUploadFileViaSSH(
  root: string,
  category: string,
  filename: string,
): Promise<boolean> {
  const response = await sendStorageRequest({ action: "delete", root, category, filename });
  return response.deleted!;
}
