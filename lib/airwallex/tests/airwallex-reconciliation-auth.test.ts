import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ config: vi.fn(), rateLimit: vi.fn(), reconcile: vi.fn() }));
vi.mock("../config/airwallex.config", () => ({ requireAirwallexConfig: mocks.config }));
vi.mock("@/lib/auth/rate-limit", () => ({ rateLimitPersistent: mocks.rateLimit }));
vi.mock("../services/airwallex-reconciliation.service", () => ({ reconcileAirwallexPayments: mocks.reconcile }));

import { POST } from "../handlers/reconcile.handler";
import { AirwallexConfigurationError } from "../errors/airwallex.errors";

const SECRET = "synthetic-independent-reconciliation-secret-0001";
function request(authorization?: string, origin?: string) {
  return new Request("https://sextoybd.net/api/payments/airwallex/reconcile", {
    method: "POST", headers: { ...(authorization ? { authorization } : {}), ...(origin ? { origin } : {}) },
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.mockReturnValue({ reconciliationSecret: SECRET });
  mocks.rateLimit.mockResolvedValue({ allowed: true, resetMs: 60_000 });
  mocks.reconcile.mockResolvedValue({ events: { processed: 1 }, payments: { confirmed: 1 } });
});

describe("Airwallex reconciliation worker authorization", () => {
  it.each([undefined, "Bearer wrong-secret", "Basic incorrect", `Bearer ${"a".repeat(513)}`])("rejects unauthorized worker requests", async (authorization) => {
    expect((await POST(request(authorization))).status).toBe(401);
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("rejects a browser Origin even if its bearer token matches", async () => {
    expect((await POST(request(`Bearer ${SECRET}`, "https://sextoybd.net"))).status).toBe(401);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("runs the worker for an authenticated server request", async () => {
    const response = await POST(request(`Bearer ${SECRET}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { events: { processed: 1 }, payments: { confirmed: 1 } } });
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
    expect(mocks.rateLimit).toHaveBeenCalledWith("airwallex-reconciliation", 12, 60_000);
  });

  it("applies the worker rate limit before processing any events", async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: false, resetMs: 60_000 });
    expect((await POST(request(`Bearer ${SECRET}`))).status).toBe(429);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("returns an unavailable response when Airwallex is disabled", async () => {
    mocks.config.mockImplementation(() => { throw new AirwallexConfigurationError(); });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await POST(request(`Bearer ${SECRET}`));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain(SECRET);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
});
