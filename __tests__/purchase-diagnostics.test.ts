import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logPurchaseDiagnostic, type PurchaseDiagnostic } from "@/lib/analytics/purchase-diagnostics";

function diagnostic(): PurchaseDiagnostic {
  return {
    eventId: "purchase:order-verified_1",
    source: "server",
    validation: "valid",
    status: "built",
  };
}

describe("opt-in sanitized Purchase diagnostics", () => {
  beforeEach(() => {
    vi.stubGlobal("window", undefined);
    vi.stubEnv("META_PURCHASE_DIAGNOSTICS", undefined);
    vi.stubEnv("NEXT_PUBLIC_META_PURCHASE_DIAGNOSTICS", undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("does not log by default in either runtime", () => {
    logPurchaseDiagnostic(diagnostic());
    vi.stubGlobal("window", {});
    logPurchaseDiagnostic({ ...diagnostic(), source: "browser" });
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it.each(["false", "1", "TRUE", "", undefined])("requires explicit true for the server switch %s", (flag) => {
    vi.stubEnv("META_PURCHASE_DIAGNOSTICS", flag);
    vi.stubEnv("NEXT_PUBLIC_META_PURCHASE_DIAGNOSTICS", "true");
    logPurchaseDiagnostic(diagnostic());
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it.each(["false", "1", "TRUE", "", undefined])("requires explicit true for the browser switch %s", (flag) => {
    vi.stubGlobal("window", {});
    vi.stubEnv("META_PURCHASE_DIAGNOSTICS", "true");
    vi.stubEnv("NEXT_PUBLIC_META_PURCHASE_DIAGNOSTICS", flag);
    logPurchaseDiagnostic({ ...diagnostic(), source: "browser" });
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("enables server diagnostics independently of the public browser flag", () => {
    vi.stubEnv("META_PURCHASE_DIAGNOSTICS", "true");
    logPurchaseDiagnostic(diagnostic());
    expect(console.info).toHaveBeenCalledExactlyOnceWith("[analytics.meta.purchase]", {
      event: "META_PURCHASE",
      ...diagnostic(),
    });
  });

  it("enables browser diagnostics independently of the server flag", () => {
    vi.stubGlobal("window", {});
    vi.stubEnv("NEXT_PUBLIC_META_PURCHASE_DIAGNOSTICS", "true");
    logPurchaseDiagnostic({ ...diagnostic(), source: "browser", status: "sdk_handoff" });
    expect(console.info).toHaveBeenCalledExactlyOnceWith("[analytics.meta.purchase]", {
      event: "META_PURCHASE",
      ...diagnostic(),
      source: "browser",
      status: "sdk_handoff",
    });
  });

  it.each([
    "built", "suppressed", "queued", "sdk_handoff", "duplicate", "unavailable",
    "delivery_failed", "script_failed", "consent_denied", "consent_revoked",
  ])("allows sanitized delivery status %s", (status) => {
    vi.stubEnv("META_PURCHASE_DIAGNOSTICS", "true");
    logPurchaseDiagnostic({ ...diagnostic(), status });
    const logger = ["delivery_failed", "script_failed"].includes(status) ? console.warn : console.info;
    expect(logger).toHaveBeenCalledExactlyOnceWith("[analytics.meta.purchase]", {
      event: "META_PURCHASE", ...diagnostic(), status,
    });
  });

  it.each(["valid", "invalid", "ineligible"] as const)("allows validation result %s", (validation) => {
    vi.stubEnv("META_PURCHASE_DIAGNOSTICS", "true");
    logPurchaseDiagnostic({ ...diagnostic(), validation });
    const logger = validation === "invalid" ? console.warn : console.info;
    expect(logger).toHaveBeenCalledExactlyOnceWith("[analytics.meta.purchase]", {
      event: "META_PURCHASE", ...diagnostic(), validation,
    });
  });

  it("records an allowlisted suppression reason without raw error or customer fields", () => {
    vi.stubEnv("META_PURCHASE_DIAGNOSTICS", "true");
    const context = {
      ...diagnostic(),
      validation: "invalid" as const,
      status: "suppressed",
      reason: "invalid_value",
      email: "customer@example.com",
      phone: "+8801712345678",
      address: "Customer private address",
      accessToken: "private-token",
      url: "https://example.com/payment?token=private-token",
      error: new Error("customer@example.com private-token"),
      payload: { email: "customer@example.com", value: "৳1,500" },
    };
    logPurchaseDiagnostic(context);
    expect(console.warn).toHaveBeenCalledExactlyOnceWith("[analytics.meta.purchase]", {
      event: "META_PURCHASE",
      eventId: "purchase:order-verified_1",
      source: "server",
      validation: "invalid",
      status: "suppressed",
      reason: "invalid_value",
    });
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("private-token");
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("customer@example.com");
  });

  it("sanitizes invalid event IDs, source, validation, status, and reason", () => {
    vi.stubEnv("META_PURCHASE_DIAGNOSTICS", "true");
    logPurchaseDiagnostic({
      eventId: "purchase:customer@example.com",
      source: "customer@example.com",
      validation: "private customer data",
      status: "request failed for customer@example.com",
      reason: "private-token from API exception",
    } as unknown as PurchaseDiagnostic);
    expect(console.warn).toHaveBeenCalledExactlyOnceWith("[analytics.meta.purchase]", {
      event: "META_PURCHASE",
      eventId: undefined,
      source: "browser",
      validation: "invalid",
      status: "unavailable",
      reason: "invalid_snapshot",
    });
  });

  it.each(["info", "warn"] as const)("isolates a failing console.%s from checkout or delivery", (method) => {
    vi.stubEnv("META_PURCHASE_DIAGNOSTICS", "true");
    vi.mocked(console[method]).mockImplementation(() => { throw new Error("logging unavailable"); });
    expect(() => logPurchaseDiagnostic({
      ...diagnostic(), validation: method === "warn" ? "invalid" : "valid",
    })).not.toThrow();
  });
});
