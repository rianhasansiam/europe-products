import { describe, expect, it } from "vitest";

import { parseAirwallexEnvironment } from "../config/airwallex.env";

const enabledEnvironment = {
  AIRWALLEX_ENABLED: "true",
  AIRWALLEX_ENV: "production",
  AIRWALLEX_CLIENT_ID: "client-id-example",
  AIRWALLEX_API_KEY: "api-key-example",
  AIRWALLEX_WEBHOOK_SECRET: "webhook-secret-example",
  AIRWALLEX_RECONCILIATION_SECRET:
    "reconciliation-secret-example-0001",
  AIRWALLEX_RETURN_URL: "https://bangbuy.example/orders/payment-return",
  NODE_ENV: "production",
} as const;

describe("parseAirwallexEnvironment", () => {
  it("allows a disabled local configuration without credentials", () => {
    const config = parseAirwallexEnvironment({ NODE_ENV: "development" });

    expect(config).toMatchObject({
      enabled: false,
      environment: "sandbox",
      browserEnvironment: "demo",
      clientId: null,
      apiKey: null,
      webhookSecret: null,
      reconciliationSecret: null,
      apiBaseUrl: "https://api.sandbox.airwallex.com",
      httpTimeoutMs: 10_000,
      webhookToleranceSeconds: 300,
    });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it("requires every server credential when enabled", () => {
    expect(() =>
      parseAirwallexEnvironment({
        AIRWALLEX_ENABLED: "true",
        NODE_ENV: "production",
      }),
    ).toThrow();
  });

  it("selects production URLs and safely converts numeric values", () => {
    const config = parseAirwallexEnvironment({
      ...enabledEnvironment,
      AIRWALLEX_PRODUCTION_API_BASE_URL: "https://api.airwallex.com/",
      AIRWALLEX_HTTP_TIMEOUT_MS: "12500",
      AIRWALLEX_WEBHOOK_TOLERANCE_SECONDS: "450",
    });

    expect(config).toMatchObject({
      enabled: true,
      environment: "production",
      browserEnvironment: "prod",
      apiBaseUrl: "https://api.airwallex.com",
      httpTimeoutMs: 12_500,
      webhookToleranceSeconds: 450,
    });
  });

  it("rejects invalid environments, API URLs, and timeout values", () => {
    expect(() =>
      parseAirwallexEnvironment({ AIRWALLEX_ENV: "preview" }),
    ).toThrow();
    expect(() =>
      parseAirwallexEnvironment({
        AIRWALLEX_SANDBOX_API_BASE_URL: "http://api.example.test",
      }),
    ).toThrow();
    expect(() =>
      parseAirwallexEnvironment({ AIRWALLEX_HTTP_TIMEOUT_MS: "999" }),
    ).toThrow();
  });

  it("allows localhost HTTP only for the Airwallex sandbox", () => {
    expect(
      parseAirwallexEnvironment({
        AIRWALLEX_ENV: "sandbox",
        NODE_ENV: "production",
        AIRWALLEX_RETURN_URL: "http://localhost:3000/orders/payment-return",
      }).returnUrl,
    ).toBe("http://localhost:3000/orders/payment-return");

    expect(() =>
      parseAirwallexEnvironment({
        AIRWALLEX_ENV: "production",
        NODE_ENV: "development",
        AIRWALLEX_RETURN_URL: "http://localhost:3000/orders/payment-return",
      }),
    ).toThrow();
  });

  it("does not include configured secret values in validation errors", () => {
    const secret = "api-key-that-must-not-appear";
    let error: unknown;
    try {
      parseAirwallexEnvironment({
        ...enabledEnvironment,
        AIRWALLEX_API_KEY: secret,
        AIRWALLEX_RETURN_URL: "javascript:alert(1)",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeDefined();
    expect(String(error)).not.toContain(secret);
  });
});
