import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AirwallexHttpClient } from "../client/airwallex-http.client";
import {
  AirwallexApiError,
  AirwallexTimeoutError,
  handleAirwallexApiError,
} from "../errors/airwallex.errors";

const successSchema = z
  .object({
    ok: z.literal(true),
    requestId: z.string(),
  })
  .strip();

function createClient(
  fetchImplementation: ReturnType<typeof vi.fn>,
  options: {
    sleep?: (milliseconds: number) => Promise<void>;
    random?: () => number;
  } = {},
) {
  return new AirwallexHttpClient({
    apiBaseUrl: "https://api.sandbox.airwallex.com",
    httpTimeoutMs: 2_500,
    fetchImplementation: fetchImplementation as unknown as typeof fetch,
    sleep: options.sleep,
    random: options.random,
  });
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the request to reject.");
}

describe("AirwallexHttpClient", () => {
  it("returns only a successfully validated provider response", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          requestId: "request-123",
          providerDebug: "must-be-stripped",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = createClient(fetchImplementation);

    await expect(
      client.request("/api/v1/example", {
        method: "POST",
        headers: { Authorization: "Bearer access-token" },
        body: { request_id: "request-123" },
        responseSchema: successSchema,
      }),
    ).resolves.toEqual({ ok: true, requestId: "request-123" });

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImplementation.mock.calls[0] as [
      URL,
      RequestInit,
    ];
    expect(url.toString()).toBe(
      "https://api.sandbox.airwallex.com/api/v1/example",
    );
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
      body: JSON.stringify({ request_id: "request-123" }),
    });
    const headers = new Headers(init.headers);
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("authorization")).toBe("Bearer access-token");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("bounds timeout retries for idempotent requests", async () => {
    const timeout = Object.assign(new Error("provider timed out"), {
      name: "TimeoutError",
    });
    const fetchImplementation = vi.fn().mockRejectedValue(timeout);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = createClient(fetchImplementation, {
      sleep,
      random: () => 0,
    });

    await expect(
      client.request("/api/v1/example", {
        method: "GET",
        responseSchema: successSchema,
        idempotent: true,
        maxRetries: 100,
      }),
    ).rejects.toBeInstanceOf(AirwallexTimeoutError);

    // The implementation caps retries at three, for four total attempts.
    expect(fetchImplementation).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls).toEqual([[250], [500], [1_000]]);
  });

  it("never retries an unsafe request after a timeout or provider failure", async () => {
    const timeout = Object.assign(new Error("timeout"), {
      name: "AbortError",
    });
    const timedOutFetch = vi.fn().mockRejectedValue(timeout);
    const timedOutClient = createClient(timedOutFetch);

    await expect(
      timedOutClient.request("/api/v1/example", {
        method: "POST",
        body: { operation: "unsafe" },
        responseSchema: successSchema,
        maxRetries: 3,
      }),
    ).rejects.toBeInstanceOf(AirwallexTimeoutError);
    expect(timedOutFetch).toHaveBeenCalledTimes(1);

    const failedFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "service_unavailable" }), {
        status: 503,
      }),
    );
    const failedClient = createClient(failedFetch);
    await expect(
      failedClient.request("/api/v1/example", {
        method: "POST",
        body: { operation: "unsafe" },
        responseSchema: successSchema,
        maxRetries: 3,
      }),
    ).rejects.toBeInstanceOf(AirwallexApiError);
    expect(failedFetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    [401, "authentication_failed"],
    [400, "invalid_request"],
  ] as const)(
    "maps provider HTTP %s to a safe non-retryable API error",
    async (status, code) => {
      const fetchImplementation = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code } }), { status }),
      );
      const client = createClient(fetchImplementation);

      const thrown = await captureError(
        client.request("/api/v1/example", {
          method: "GET",
          responseSchema: successSchema,
          idempotent: true,
          maxRetries: 3,
        }),
      );

      expect(thrown).toBeInstanceOf(AirwallexApiError);
      const error = thrown as AirwallexApiError;
      expect(error.providerStatus).toBe(status);
      expect(error.retryable).toBe(false);
      expect(error.details).toEqual({
        code: "AIRWALLEX_API_ERROR",
        providerCode: code.toUpperCase(),
      });
      expect(fetchImplementation).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects invalid JSON from an otherwise successful provider response", async () => {
    const rawProviderBody = "not-json payment-provider-internal-body";
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(new Response(rawProviderBody, { status: 200 }));
    const client = createClient(fetchImplementation);

    const thrown = await captureError(
      client.request("/api/v1/example", {
        method: "GET",
        responseSchema: successSchema,
      }),
    );

    expect(thrown).toBeInstanceOf(AirwallexApiError);
    expect(String(thrown)).not.toContain(rawProviderBody);
  });

  it("never logs or exposes secret-bearing provider error bodies", async () => {
    const accessToken = "access-token-secret-marker";
    const clientSecret = "client-secret-marker";
    const apiKey = "api-key-secret-marker";
    const providerBody = {
      code: "payment_rejected",
      message: `Bearer ${accessToken}`,
      client_secret: clientSecret,
      api_key: apiKey,
      billing: { address: "private-address-marker" },
    };
    const fetchImplementation = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(providerBody), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createClient(fetchImplementation);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});

    const thrown = await captureError(
      client.request("/api/v1/example", {
        method: "POST",
        body: { request_id: "safe-request-id" },
        responseSchema: successSchema,
      }),
    );

    expect(thrown).toBeInstanceOf(AirwallexApiError);
    const serializedError = JSON.stringify({
      name: (thrown as Error).name,
      message: (thrown as Error).message,
      details: (thrown as AirwallexApiError).details,
    });
    for (const secret of [accessToken, clientSecret, apiKey, providerBody.billing.address]) {
      expect(serializedError).not.toContain(secret);
    }
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(consoleInfo).not.toHaveBeenCalled();

    const response = handleAirwallexApiError("http-client.test", thrown);
    const publicPayload = await response.json();
    expect(response.status).toBe(502);
    expect(publicPayload).toEqual({
      error: "The payment provider could not complete the request.",
      code: "AIRWALLEX_API_ERROR",
    });
    const serializedPayload = JSON.stringify(publicPayload);
    for (const secret of [accessToken, clientSecret, apiKey, providerBody.billing.address]) {
      expect(serializedPayload).not.toContain(secret);
    }
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(consoleInfo).not.toHaveBeenCalled();
  });
});
