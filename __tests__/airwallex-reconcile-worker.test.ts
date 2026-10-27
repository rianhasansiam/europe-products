import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_RECONCILIATION_URL,
  reconcileOnce,
  runWorker,
  validateReconciliationUrl,
} from "../scripts/airwallex-reconcile.mjs";

const SECRET = "synthetic-reconciliation-secret-never-a-live-credential";
const environment = {
  NODE_ENV: "test" as const,
  AIRWALLEX_ENABLED: "true",
  AIRWALLEX_RECONCILIATION_SECRET: SECRET,
};
const summary = {
  events: { claimed: 1, processed: 1, requiresReview: 0, retryScheduled: 0, persistenceErrors: 0 },
  payments: { examined: 2, reconciled: 2, confirmed: 1, terminalized: 0, stillPending: 1, requiresReview: 0, errors: 0 },
};

function success() {
  return Response.json({ success: true, data: summary });
}

async function flushPromises() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Airwallex reconciliation worker destination", () => {
  it.each([
    "http://127.0.0.1:3002/api/payments/airwallex/reconcile",
    "http://127.0.0.1:3004/api/payments/airwallex/reconcile",
    "http://[::1]:3002/api/payments/airwallex/reconcile",
  ])("accepts a literal loopback endpoint: %s", (url) => {
    expect(validateReconciliationUrl(url)).toBe(url);
  });

  it.each([
    "https://sextoybd.net/api/payments/airwallex/reconcile",
    "http://example.test/api/payments/airwallex/reconcile",
    "http://127.0.0.1.example.test/api/payments/airwallex/reconcile",
    "http://localhost:3002/api/payments/airwallex/reconcile",
    "http://127.0.0.2:3002/api/payments/airwallex/reconcile",
    "http://user:password@127.0.0.1:3002/api/payments/airwallex/reconcile",
    "http://127.0.0.1:3002/api/payments/airwallex/reconcile?token=secret",
    "http://127.0.0.1:3002/api/payments/airwallex/reconcile#secret",
    "http://127.0.0.1:3002/api/payments/airwallex/initiate",
    "http://127.0.0.1:3002/api/payments/airwallex/reconcile/",
  ])("rejects remote, credential-bearing, or incorrect destinations: %s", (url) => {
    expect(() => validateReconciliationUrl(url)).toThrow();
  });
});

describe("Airwallex reconciliation worker requests", () => {
  it.each([undefined, "false", "TRUE", "1"])("makes no request when enabled=%s, even without credentials", async (enabled) => {
    const fetchImplementation = vi.fn<typeof fetch>();
    const result = await reconcileOnce({
      environment: { NODE_ENV: "test", AIRWALLEX_ENABLED: enabled }, fetchImplementation,
    });

    expect(result).toMatchObject({ status: "disabled" });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "short", `synthetic-secret-${"a".repeat(20)}\nInjected: true`])(
    "rejects missing, short, or header-injection secrets before requesting", async (secret) => {
      const fetchImplementation = vi.fn<typeof fetch>();
      const result = await reconcileOnce({
        environment: { NODE_ENV: "test", AIRWALLEX_ENABLED: "true", AIRWALLEX_RECONCILIATION_SECRET: secret }, fetchImplementation,
      });
      expect(result).toMatchObject({ status: "failed", reason: "configuration" });
      expect(fetchImplementation).not.toHaveBeenCalled();
      expect(JSON.stringify(result)).not.toContain("Injected");
    },
  );

  it("posts only to loopback with the bearer token, no browser origin/cookies, and no redirect following", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(success());
    const result = await reconcileOnce({ environment, fetchImplementation });

    expect(result).toMatchObject({ status: "ok", summary });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImplementation.mock.calls[0];
    expect(String(url)).toBe(DEFAULT_RECONCILIATION_URL);
    expect(options).toMatchObject({ method: "POST", redirect: "error", credentials: "omit" });
    const headers = new Headers(options?.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${SECRET}`);
    expect(headers.has("origin")).toBe(false);
    expect(headers.has("cookie")).toBe(false);
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });

  it("rejects an unsafe configured endpoint before its bearer token could leave the machine", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    const result = await reconcileOnce({
      environment: { ...environment, AIRWALLEX_RECONCILIATION_URL: `https://example.test/reconcile?token=${SECRET}` },
      fetchImplementation,
    });
    expect(result).toMatchObject({ status: "failed", reason: "configuration" });
    expect(fetchImplementation).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });

  it("does not read or return an HTTP error body that may contain sensitive diagnostics", async () => {
    const response = new Response(`Bearer ${SECRET}: provider failure`, { status: 503 });
    const text = vi.spyOn(response, "text");
    const json = vi.spyOn(response, "json");
    const arrayBuffer = vi.spyOn(response, "arrayBuffer");
    const result = await reconcileOnce({
      environment, fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(response),
    });

    expect(result).toMatchObject({ status: "failed", reason: "http", httpStatus: 503 });
    expect(text).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(JSON.stringify(result)).not.toContain("provider failure");
  });

  it.each([
    { success: false, error: SECRET },
    { success: true, data: { ...summary, events: { ...summary.events, claimed: SECRET } } },
    { success: true, data: { ...summary, payments: { ...summary.payments, errors: -1 } } },
    { success: true, data: { ...summary, payments: null } },
  ])("rejects malformed successful responses without returning their payload: %j", async (payload) => {
    const result = await reconcileOnce({
      environment, fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(Response.json(payload)),
    });
    expect(result).toMatchObject({ status: "failed", reason: "response" });
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });

  it("discards unknown response fields instead of leaking payment diagnostics", async () => {
    const result = await reconcileOnce({
      environment,
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(Response.json({
        success: true,
        data: { ...summary, authorization: SECRET, events: { ...summary.events, internalError: SECRET } },
      })),
    });
    expect(result).toMatchObject({ status: "ok", summary });
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(result.summary).toEqual(summary);
  });

  it("returns a safe network result rather than an exception message", async () => {
    const result = await reconcileOnce({
      environment,
      fetchImplementation: vi.fn<typeof fetch>().mockRejectedValue(new Error(`Bearer ${SECRET}: private diagnostic`)),
    });
    expect(result).toMatchObject({ status: "failed", reason: "network" });
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(JSON.stringify(result)).not.toContain("private diagnostic");
  });

  it("aborts a timed-out request and removes its timeout", async () => {
    vi.useFakeTimers();
    const fetchImplementation = vi.fn<typeof fetch>().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener("abort", () => reject(new DOMException("Request aborted", "AbortError")), { once: true });
    }));
    const result = reconcileOnce({ environment, fetchImplementation, timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(50);

    expect(await result).toMatchObject({ status: "failed", reason: "timeout" });
    expect(fetchImplementation.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up an in-flight request when shutdown is requested", async () => {
    vi.useFakeTimers();
    const shutdown = new AbortController();
    const fetchImplementation = vi.fn<typeof fetch>().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener("abort", () => reject(new DOMException("Request aborted", "AbortError")), { once: true });
    }));
    const result = reconcileOnce({ environment, fetchImplementation, signal: shutdown.signal });
    shutdown.abort();

    expect(await result).toMatchObject({ status: "aborted" });
    expect(fetchImplementation.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("removes request timeout state after a successful response", async () => {
    vi.useFakeTimers();
    expect(await reconcileOnce({ environment, fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(success()) }))
      .toMatchObject({ status: "ok" });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("Airwallex reconciliation worker scheduling", () => {
  it("keeps requests sequential and backs off failures before resetting the normal interval", async () => {
    const shutdown = new AbortController();
    const logger = vi.fn();
    const delays: number[] = [];
    let finishFirst!: (response: Response) => void;
    const firstRequest = new Promise<Response>((resolve) => { finishFirst = resolve; });
    let inFlight = 0;
    let maximumInFlight = 0;
    let requests = 0;
    const fetchImplementation = vi.fn<typeof fetch>().mockImplementation(async () => {
      inFlight++;
      maximumInFlight = Math.max(maximumInFlight, inFlight);
      const current = ++requests;
      try {
        if (current === 1) return await firstRequest;
        if (current === 2) throw new Error(`Private failure ${SECRET}`);
        return success();
      } finally {
        inFlight--;
      }
    });
    const sleep = vi.fn(async (ms: number): Promise<undefined> => {
      delays.push(ms);
      if (delays.length === 3) shutdown.abort();
      return undefined;
    });
    const worker = runWorker({ environment, fetchImplementation, signal: shutdown.signal, logger, sleep });
    await flushPromises();
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();

    finishFirst(new Response(`Bearer ${SECRET}`, { status: 503 }));
    await worker;

    expect(maximumInFlight).toBe(1);
    expect(fetchImplementation).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([30_000, 60_000, 30_000]);
    expect(JSON.stringify(logger.mock.calls)).not.toContain(SECRET);
    expect(JSON.stringify(logger.mock.calls)).not.toContain("Private failure");
  });

  it("caps repeated-failure backoff rather than spinning or increasing it indefinitely", async () => {
    const shutdown = new AbortController();
    const delays: number[] = [];
    await runWorker({
      environment,
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })),
      logger: vi.fn(), signal: shutdown.signal,
      sleep: async (ms: number) => { delays.push(ms); if (delays.length === 6) shutdown.abort(); },
    });
    expect(delays).toEqual([30_000, 60_000, 120_000, 240_000, 300_000, 300_000]);
  });

  it.each([
    { ...summary, events: { ...summary.events, retryScheduled: 1 } },
    { ...summary, events: { ...summary.events, persistenceErrors: 1 } },
    { ...summary, payments: { ...summary.payments, errors: 1 } },
  ])("backs off processing errors reported inside HTTP 200 responses: %j", async (failedSummary) => {
    const shutdown = new AbortController();
    const delays: number[] = [];
    const logger = vi.fn();
    const fetchImplementation = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ success: true, data: failedSummary }))
      .mockResolvedValueOnce(Response.json({ success: true, data: failedSummary }))
      .mockResolvedValueOnce(success());
    await runWorker({
      environment, fetchImplementation, logger, signal: shutdown.signal,
      sleep: async (ms: number) => { delays.push(ms); if (delays.length === 3) shutdown.abort(); },
    });
    expect(delays).toEqual([30_000, 60_000, 30_000]);
    expect(logger.mock.calls[0][0]).toMatchObject({ status: "ok", summary: failedSummary });
  });

  it("can stop the real default sleep promptly without making another request", async () => {
    const shutdown = new AbortController();
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(success());
    const logger = vi.fn();
    const worker = runWorker({ environment, fetchImplementation, signal: shutdown.signal, logger });
    await flushPromises();
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(logger).toHaveBeenCalledTimes(1);
    shutdown.abort();
    await worker;
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("stays disabled without issuing requests or flooding logs every interval", async () => {
    const shutdown = new AbortController();
    const fetchImplementation = vi.fn<typeof fetch>();
    const logger = vi.fn();
    let sleeps = 0;
    await runWorker({
      environment: { NODE_ENV: "test", AIRWALLEX_ENABLED: "false" }, fetchImplementation, logger, signal: shutdown.signal,
      sleep: async () => { if (++sleeps === 3) shutdown.abort(); },
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
    expect(logger).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.mock.calls)).toContain("disabled");
  });
});

describe("Airwallex reconciliation worker entry point", () => {
  it("can be imported without starting requests, timers, or signal handlers", async () => {
    vi.useFakeTimers();
    const fetchImplementation = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchImplementation);
    const sigterm = process.listenerCount("SIGTERM");
    const sigint = process.listenerCount("SIGINT");
    vi.resetModules();
    await import("../scripts/airwallex-reconcile.mjs");
    expect(fetchImplementation).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(process.listenerCount("SIGTERM")).toBe(sigterm);
    expect(process.listenerCount("SIGINT")).toBe(sigint);
  });

  it("supports a disabled --once check that exits successfully without credentials", () => {
    const child = spawnSync(process.execPath, [resolve("scripts/airwallex-reconcile.mjs"), "--once"], {
      env: { NODE_ENV: "test", AIRWALLEX_ENABLED: "false" }, encoding: "utf8", timeout: 5_000,
    });
    expect(child.status, child.stderr).toBe(0);
    expect(child.signal).toBeNull();
    expect(child.stdout).toContain("disabled");
    expect(child.stdout).not.toContain(SECRET);
  });

  it("exits a disabled persistent CLI worker cleanly on SIGTERM", async () => {
    const child = spawn(process.execPath, [resolve("scripts/airwallex-reconcile.mjs")], {
      env: { NODE_ENV: "test", AIRWALLEX_ENABLED: "false" }, stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolveExit, reject) => {
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("Disabled worker did not shut down promptly"));
      }, 3_000);
      child.once("error", (error) => { clearTimeout(timeout); reject(error); });
      child.once("close", (code, signal) => { clearTimeout(timeout); resolveExit({ code, signal }); });
      child.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString();
        if (output.includes('"status":"disabled"')) child.kill("SIGTERM");
      });
    });
    expect(output).toContain('"status":"disabled"');
    expect(result).toEqual({ code: 0, signal: null });
  });
});
