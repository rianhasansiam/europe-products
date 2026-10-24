import "server-only";

import type { ZodType } from "zod";

import type { AirwallexEnvironment } from "../config/airwallex.env";
import {
  AirwallexApiError,
  AirwallexTimeoutError,
} from "../errors/airwallex.errors";
import { sanitizeAirwallexCode } from "../security/airwallex-redaction";

type FetchImplementation = typeof fetch;

type AirwallexHttpClientOptions = Pick<
  AirwallexEnvironment,
  "apiBaseUrl" | "httpTimeoutMs"
> & {
  fetchImplementation?: FetchImplementation;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
};

export type AirwallexHttpRequest<T> = {
  method: "GET" | "POST";
  headers?: HeadersInit;
  body?: unknown;
  responseSchema: ZodType<T>;
  /** True only for GETs or operations protected by an Airwallex request_id. */
  idempotent?: boolean;
  maxRetries?: number;
};

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

function providerErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.code === "string") {
    return sanitizeAirwallexCode(record.code);
  }
  const nested = record.error;
  if (nested && typeof nested === "object") {
    return sanitizeAirwallexCode((nested as Record<string, unknown>).code);
  }
  return null;
}

function retryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export class AirwallexHttpClient {
  private readonly apiBaseUrl: URL;
  private readonly timeoutMs: number;
  private readonly fetchImplementation: FetchImplementation;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly random: () => number;

  constructor(options: AirwallexHttpClientOptions) {
    this.apiBaseUrl = new URL(`${options.apiBaseUrl.replace(/\/$/, "")}/`);
    this.timeoutMs = options.httpTimeoutMs;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.random = options.random ?? Math.random;
  }

  async request<T>(path: string, request: AirwallexHttpRequest<T>): Promise<T> {
    if (!path.startsWith("/") || path.startsWith("//")) {
      throw new AirwallexApiError();
    }
    const url = new URL(path.slice(1), this.apiBaseUrl);
    if (url.origin !== this.apiBaseUrl.origin) {
      throw new AirwallexApiError();
    }

    const maxRetries = request.idempotent
      ? Math.min(Math.max(request.maxRetries ?? 2, 0), 3)
      : 0;
    let attempt = 0;

    while (true) {
      try {
        const headers = new Headers(request.headers);
        headers.set("Accept", "application/json");
        if (request.body !== undefined) {
          headers.set("Content-Type", "application/json");
        }

        const response = await this.fetchImplementation(url, {
          method: request.method,
          headers,
          body:
            request.body === undefined
              ? undefined
              : JSON.stringify(request.body),
          cache: "no-store",
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        const text = await response.text();
        let payload: unknown = null;
        if (text) {
          try {
            payload = JSON.parse(text);
          } catch {
            if (!response.ok) {
              throw new AirwallexApiError({
                providerStatus: response.status,
                retryable: retryableStatus(response.status),
              });
            }
            throw new AirwallexApiError();
          }
        }

        if (!response.ok) {
          const error = new AirwallexApiError({
            providerStatus: response.status,
            providerCode: providerErrorCode(payload),
            retryable: retryableStatus(response.status),
          });
          if (attempt < maxRetries && error.retryable) {
            await this.backoff(attempt);
            attempt += 1;
            continue;
          }
          throw error;
        }

        const parsed = request.responseSchema.safeParse(payload);
        if (!parsed.success) throw new AirwallexApiError();
        return parsed.data;
      } catch (error) {
        if (error instanceof AirwallexApiError) throw error;
        const mapped = isTimeoutError(error)
          ? new AirwallexTimeoutError()
          : new AirwallexApiError({ retryable: true });
        if (attempt < maxRetries && mapped.retryable) {
          await this.backoff(attempt);
          attempt += 1;
          continue;
        }
        throw mapped;
      }
    }
  }

  private backoff(attempt: number): Promise<void> {
    const exponential = Math.min(250 * 2 ** attempt, 2_000);
    const jitter = Math.floor(this.random() * 150);
    return this.sleep(exponential + jitter);
  }
}
