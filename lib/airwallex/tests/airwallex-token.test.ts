import { describe, expect, it, vi } from "vitest";

vi.mock("../config/airwallex.config", () => ({
  airwallexConfig: {
    apiBaseUrl: "https://api.sandbox.airwallex.com",
    httpTimeoutMs: 10_000,
    clientId: null,
    apiKey: null,
  },
}));

import type { AirwallexHttpClient } from "../client/airwallex-http.client";
import { createAirwallexTokenService } from "../client/airwallex-token.service";
import {
  AirwallexApiError,
  AirwallexAuthenticationError,
} from "../errors/airwallex.errors";

type RequestMock = ReturnType<typeof vi.fn>;

function fakeHttpClient(request: RequestMock): AirwallexHttpClient {
  return { request } as unknown as AirwallexHttpClient;
}

function tokenResponse(token: string, expiresAtMs: number) {
  return { token, expires_at: new Date(expiresAtMs).toISOString() };
}

describe("createAirwallexTokenService", () => {
  it("reuses a cached token before the refresh window", async () => {
    let nowMs = Date.parse("2026-08-04T10:00:00Z");
    const request = vi
      .fn()
      .mockResolvedValue(tokenResponse("token-one", nowMs + 30 * 60_000));
    const service = createAirwallexTokenService({
      config: { clientId: "client", apiKey: "key" },
      httpClient: fakeHttpClient(request),
      now: () => nowMs,
      refreshSkewMs: 60_000,
    });

    await expect(service.getAccessToken()).resolves.toBe("token-one");
    nowMs += 10 * 60_000;
    await expect(service.getAccessToken()).resolves.toBe("token-one");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("refreshes before expiry", async () => {
    let nowMs = Date.parse("2026-08-04T10:00:00Z");
    const request = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse("token-one", nowMs + 70_000))
      .mockImplementationOnce(() =>
        Promise.resolve(tokenResponse("token-two", nowMs + 30 * 60_000)),
      );
    const service = createAirwallexTokenService({
      config: { clientId: "client", apiKey: "key" },
      httpClient: fakeHttpClient(request),
      now: () => nowMs,
      refreshSkewMs: 60_000,
    });

    await expect(service.getAccessToken()).resolves.toBe("token-one");
    nowMs += 15_000;
    await expect(service.getAccessToken()).resolves.toBe("token-two");
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent refreshes with one promise lock", async () => {
    const nowMs = Date.parse("2026-08-04T10:00:00Z");
    let resolveRefresh!: (value: ReturnType<typeof tokenResponse>) => void;
    const pending = new Promise<ReturnType<typeof tokenResponse>>((resolve) => {
      resolveRefresh = resolve;
    });
    const request = vi.fn().mockReturnValue(pending);
    const service = createAirwallexTokenService({
      config: { clientId: "client", apiKey: "key" },
      httpClient: fakeHttpClient(request),
      now: () => nowMs,
    });

    const first = service.getAccessToken();
    const second = service.getAccessToken();
    expect(request).toHaveBeenCalledTimes(1);

    resolveRefresh(tokenResponse("shared-token", nowMs + 30 * 60_000));
    await expect(Promise.all([first, second])).resolves.toEqual([
      "shared-token",
      "shared-token",
    ]);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("clears only the expected cached token", async () => {
    const nowMs = Date.parse("2026-08-04T10:00:00Z");
    const request = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse("token-one", nowMs + 30 * 60_000))
      .mockResolvedValueOnce(tokenResponse("token-two", nowMs + 30 * 60_000));
    const service = createAirwallexTokenService({
      config: { clientId: "client", apiKey: "key" },
      httpClient: fakeHttpClient(request),
      now: () => nowMs,
    });

    await service.getAccessToken();
    service.clearAccessToken("different-token");
    await expect(service.getAccessToken()).resolves.toBe("token-one");
    service.clearAccessToken("token-one");
    await expect(service.getAccessToken()).resolves.toBe("token-two");
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("rejects missing credentials and maps provider authentication failures", async () => {
    const missingRequest = vi.fn();
    const missing = createAirwallexTokenService({
      config: { clientId: null, apiKey: null },
      httpClient: fakeHttpClient(missingRequest),
    });
    await expect(missing.getAccessToken()).rejects.toBeInstanceOf(
      AirwallexAuthenticationError,
    );
    expect(missingRequest).not.toHaveBeenCalled();

    const rejectedRequest = vi
      .fn()
      .mockRejectedValue(new AirwallexApiError({ providerStatus: 401 }));
    const rejected = createAirwallexTokenService({
      config: { clientId: "client", apiKey: "wrong-key" },
      httpClient: fakeHttpClient(rejectedRequest),
    });
    await expect(rejected.getAccessToken()).rejects.toBeInstanceOf(
      AirwallexAuthenticationError,
    );
  });
});
