import { describe, expect, it } from "vitest";

import {
  gatewayPaymentBlocksCancellation,
  type CancellationPaymentSnapshot,
} from "@/lib/orders/payment-cancellation";

function airwallexPayment(
  overrides: Partial<CancellationPaymentSnapshot> = {},
): CancellationPaymentSnapshot {
  return {
    provider: "AIRWALLEX",
    status: "FAILED",
    requiresReview: false,
    transactionId: null,
    providerStatus: "CREATE_REJECTED_400",
    ...overrides,
  };
}

function blocksCancellation(
  payments: readonly CancellationPaymentSnapshot[],
): boolean {
  return gatewayPaymentBlocksCancellation({
    paymentMethod: "AIRWALLEX",
    paymentStatus: "FAILED",
    payments,
  });
}

describe("Airwallex order cancellation safety", () => {
  it("allows only a demonstrably never-initiated new reservation", () => {
    expect(blocksCancellation([airwallexPayment({ status: "CREATED", providerStatus: "LOCAL_RESERVED" })])).toBe(false);
    for (const providerStatus of ["LOCAL_CREATED", "CREATE_REQUESTED", null]) {
      expect(blocksCancellation([airwallexPayment({ status: "CREATED", providerStatus })])).toBe(true);
    }
    expect(blocksCancellation([airwallexPayment({ status: "CREATED", providerStatus: "LOCAL_RESERVED", transactionId: "int_bound" })])).toBe(true);
    expect(blocksCancellation([airwallexPayment({ status: "CREATED", providerStatus: "LOCAL_RESERVED", requiresReview: true })])).toBe(true);
  });

  it.each([400, 401, 403, 422])(
    "allows an unbound definitive %i create rejection",
    (providerStatus) => {
      expect(
        blocksCancellation([
          airwallexPayment({
            providerStatus: `CREATE_REJECTED_${providerStatus}`,
          }),
        ]),
      ).toBe(false);
    },
  );

  it.each([408, 409, 425, 429])(
    "continues blocking an ambiguous %i create outcome",
    (providerStatus) => {
      expect(
        blocksCancellation([
          airwallexPayment({
            providerStatus: `CREATE_REJECTED_${providerStatus}`,
          }),
        ]),
      ).toBe(true);
    },
  );

  it("continues blocking provider-bound and unmarked failures", () => {
    expect(
      blocksCancellation([
        airwallexPayment({ transactionId: "int_existing123" }),
      ]),
    ).toBe(true);
    expect(
      blocksCancellation([
        airwallexPayment({ providerStatus: "REQUIRES_PAYMENT_METHOD" }),
      ]),
    ).toBe(true);
    expect(
      blocksCancellation([
        airwallexPayment({ providerStatus: "CREATE_REJECTED_500" }),
      ]),
    ).toBe(true);
  });

  it("continues blocking active, successful, and review-held attempts", () => {
    expect(blocksCancellation([airwallexPayment({ status: "CREATED" })])).toBe(
      true,
    );
    expect(blocksCancellation([airwallexPayment({ status: "SUCCESS" })])).toBe(
      true,
    );
    expect(
      blocksCancellation([airwallexPayment({ requiresReview: true })]),
    ).toBe(true);
  });

  it("blocks when any sibling attempt remains unsafe", () => {
    expect(
      blocksCancellation([
        airwallexPayment(),
        airwallexPayment({
          status: "CREATED",
          providerStatus: "LOCAL_CREATED",
        }),
      ]),
    ).toBe(true);
  });
});
