#!/usr/bin/env node

import { setTimeout as wait } from "node:timers/promises";
import { pathToFileURL } from "node:url";

export const DEFAULT_RECONCILIATION_URL =
  "http://127.0.0.1:3002/api/payments/airwallex/reconcile";
const DEFAULT_INTERVAL_MS = 30_000;
const MAX_REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_BACKOFF_MS = 300_000;
const MAX_RESPONSE_BYTES = 16 * 1024;

/** Credentials must never leave this machine, including through redirects. */
export function validateReconciliationUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("The reconciliation URL must use the local payment endpoint.");
  }
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username || url.password || url.search || url.hash ||
    url.pathname !== "/api/payments/airwallex/reconcile"
  ) {
    throw new Error("The reconciliation URL must use the local payment endpoint.");
  }
  return url.toString();
}

function validDuration(value, maximum = Number.MAX_SAFE_INTEGER) {
  return Number.isSafeInteger(value) && value > 0 && value <= maximum;
}

function configuration(environment, timeoutMs) {
  if (environment.AIRWALLEX_ENABLED !== "true") return { enabled: false };
  const secret = environment.AIRWALLEX_RECONCILIATION_SECRET?.trim();
  if (
    typeof secret !== "string" || secret.length < 32 || secret.length > 505 ||
    /[\r\n]/.test(secret) || !validDuration(timeoutMs, MAX_REQUEST_TIMEOUT_MS)
  ) {
    throw new Error("Reconciliation configuration is incomplete.");
  }
  return {
    enabled: true,
    secret,
    url: validateReconciliationUrl(
      environment.AIRWALLEX_RECONCILIATION_URL ?? DEFAULT_RECONCILIATION_URL,
    ),
  };
}

function numericSummary(payload) {
  if (!payload || payload.success !== true || !payload.data) return null;
  const groups = {
    events: ["claimed", "processed", "requiresReview", "retryScheduled", "persistenceErrors"],
    payments: ["examined", "reconciled", "confirmed", "terminalized", "stillPending", "requiresReview", "errors"],
  };
  const output = {};
  for (const [group, fields] of Object.entries(groups)) {
    const source = payload.data[group];
    if (!source || typeof source !== "object" || Array.isArray(source)) return null;
    output[group] = {};
    for (const field of fields) {
      const value = source[field];
      if (!Number.isSafeInteger(value) || value < 0) return null;
      output[group][field] = value;
    }
  }
  return output;
}

async function discardResponse(response) {
  try {
    await response.body?.cancel();
  } catch {
    // Closing an unread response must not expose transport diagnostics.
  }
}

/**
 * One bounded run. This retrieves provider states; it never initiates a charge.
 * @param {{ environment?: Record<string, string | undefined>, fetchImplementation?: typeof fetch, signal?: AbortSignal, timeoutMs?: number }} [options]
 */
export async function reconcileOnce({
  environment = process.env,
  fetchImplementation = globalThis.fetch,
  signal,
  timeoutMs = MAX_REQUEST_TIMEOUT_MS,
} = {}) {
  if (signal?.aborted) return { status: "aborted" };
  let config;
  try {
    config = configuration(environment, timeoutMs);
  } catch {
    return { status: "failed", reason: "configuration" };
  }
  if (!config.enabled) return { status: "disabled" };

  const request = new AbortController();
  let timedOut = false;
  const stopRequest = () => request.abort();
  signal?.addEventListener("abort", stopRequest, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    request.abort();
  }, timeoutMs);

  try {
    const response = await fetchImplementation(config.url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.secret}`,
      },
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      signal: request.signal,
    });
    if (signal?.aborted) return { status: "aborted" };
    if (!response.ok) {
      // Provider/application error bodies can contain sensitive diagnostics.
      // Never read, return, or log them.
      await discardResponse(response);
      return { status: "failed", reason: "http", httpStatus: response.status };
    }

    let summary;
    try {
      if (Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES) {
        await discardResponse(response);
        return { status: "failed", reason: "response" };
      }
      const body = await response.text();
      if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
        return { status: "failed", reason: "response" };
      }
      summary = numericSummary(JSON.parse(body));
    } catch {
      if (signal?.aborted) return { status: "aborted" };
      if (timedOut) return { status: "failed", reason: "timeout" };
      return { status: "failed", reason: "response" };
    }
    if (signal?.aborted) return { status: "aborted" };
    if (!summary) return { status: "failed", reason: "response" };
    return { status: "ok", summary };
  } catch {
    if (signal?.aborted) return { status: "aborted" };
    return { status: "failed", reason: timedOut ? "timeout" : "network" };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", stopRequest);
  }
}

function safeLog(result, logger) {
  const event = { event: "airwallex.reconciliation.worker", status: result.status };
  if (result.reason) event.reason = result.reason;
  if (result.httpStatus) event.httpStatus = result.httpStatus;
  if (result.summary) event.summary = result.summary;
  logger(event);
}

function defaultLogger(event) {
  console.info(JSON.stringify(event));
}

/**
 * Each request completes before the next delay starts, so a slow run cannot
 * produce overlapping requests. Failures back off; disabled deployments idle.
 * @param {{ environment?: Record<string, string | undefined>, fetchImplementation?: typeof fetch, signal?: AbortSignal, logger?: (event: Record<string, unknown>) => void, sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>, intervalMs?: number, timeoutMs?: number, maxBackoffMs?: number }} [options]
 */
export async function runWorker({
  environment = process.env,
  fetchImplementation = globalThis.fetch,
  signal,
  logger = defaultLogger,
  sleep = (milliseconds, stopSignal) => wait(milliseconds, undefined, { signal: stopSignal }),
  intervalMs = DEFAULT_INTERVAL_MS,
  timeoutMs = MAX_REQUEST_TIMEOUT_MS,
  maxBackoffMs = DEFAULT_MAX_BACKOFF_MS,
} = {}) {
  if (!validDuration(intervalMs) || !validDuration(maxBackoffMs) || maxBackoffMs < intervalMs) {
    throw new Error("Invalid reconciliation worker timing.");
  }
  let failures = 0;
  let previousStatus;
  while (!signal?.aborted) {
    const result = await reconcileOnce({ environment, fetchImplementation, signal, timeoutMs });
    if (result.status === "aborted") break;
    if (result.status !== "disabled" || previousStatus !== "disabled") safeLog(result, logger);
    previousStatus = result.status;
    const processingErrors = result.summary && (
      result.summary.events.retryScheduled > 0 ||
      result.summary.events.persistenceErrors > 0 ||
      result.summary.payments.errors > 0
    );
    failures = result.status === "failed" || processingErrors ? failures + 1 : 0;
    const delay = failures
      ? Math.min(intervalMs * 2 ** Math.min(failures - 1, 20), maxBackoffMs)
      : intervalMs;
    try {
      await sleep(delay, signal);
    } catch {
      if (signal?.aborted) break;
      throw new Error("Reconciliation worker scheduling failed.");
    }
  }
}

export async function main(arguments_ = process.argv.slice(2)) {
  if (arguments_.some((argument) => argument !== "--once") || arguments_.length > 1) {
    console.error("Usage: node scripts/airwallex-reconcile.mjs [--once]");
    return 2;
  }
  const shutdown = new AbortController();
  const stop = () => shutdown.abort();
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  try {
    if (arguments_.includes("--once")) {
      const result = await reconcileOnce({ signal: shutdown.signal });
      safeLog(result, defaultLogger);
      return result.status === "failed" ? 1 : 0;
    }
    await runWorker({ signal: shutdown.signal });
    return 0;
  } catch {
    console.error(JSON.stringify({ event: "airwallex.reconciliation.worker", status: "failed", reason: "worker" }));
    return 1;
  } finally {
    process.removeListener("SIGTERM", stop);
    process.removeListener("SIGINT", stop);
  }
}

// Importing helpers for tests or operations must never start the worker.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
