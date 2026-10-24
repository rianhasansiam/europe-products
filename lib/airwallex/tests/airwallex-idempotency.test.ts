import { describe, expect, it } from "vitest";

import {
  createAirwallexRequestId,
  deriveAirwallexRequestId,
  isAirwallexRequestId,
} from "../security/airwallex-idempotency";

describe("Airwallex request IDs", () => {
  it("creates a provider-safe UUID v4 within Airwallex's length limit", () => {
    const requestId = createAirwallexRequestId();

    expect(requestId.length).toBeLessThanOrEqual(64);
    expect(isAirwallexRequestId(requestId)).toBe(true);
  });

  it("rejects malformed, non-v4, and oversized request IDs", () => {
    expect(isAirwallexRequestId("not-a-uuid")).toBe(false);
    expect(
      isAirwallexRequestId("6ba7b810-9dad-11d1-80b4-00c04fd430c8"),
    ).toBe(false);
    expect(
      isAirwallexRequestId(`123e4567-e89b-42d3-a456-${"0".repeat(60)}`),
    ).toBe(false);
  });

  it("derives the same opaque request ID for the same owner checkout retry", () => {
    const ownerId = "user_private_identifier";
    const checkoutAttemptId = "040f06ec-3394-4a77-bad2-8c8ec9150479";
    const first = deriveAirwallexRequestId(ownerId, checkoutAttemptId);
    const second = deriveAirwallexRequestId(ownerId, checkoutAttemptId);

    expect(first).toBe(second);
    expect(isAirwallexRequestId(first)).toBe(true);
    expect(first).not.toContain(ownerId);
  });

  it("domain-separates different owners and browser attempts", () => {
    const checkoutAttemptId = "040f06ec-3394-4a77-bad2-8c8ec9150479";

    expect(
      deriveAirwallexRequestId("user_a", checkoutAttemptId),
    ).not.toBe(deriveAirwallexRequestId("user_b", checkoutAttemptId));
    expect(
      deriveAirwallexRequestId("user_a", checkoutAttemptId),
    ).not.toBe(
      deriveAirwallexRequestId(
        "user_a",
        "3fb0a9e6-5f28-4482-a8f1-6911e6e5a5ac",
      ),
    );
  });
});
