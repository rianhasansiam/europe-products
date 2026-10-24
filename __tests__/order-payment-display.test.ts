import { describe, expect, it } from "vitest";

import { getAirwallexPaymentDisplay } from "@/features/orders/payment";

describe("Airwallex order payment display", () => {
  it("returns a valid payment snapshot when it differs from the display total", () => {
    expect(
      getAirwallexPaymentDisplay({
        paymentMethod: "AIRWALLEX",
        paymentAmount: 10.63,
        paymentCurrency: "EUR",
        displayAmount: 1_250,
        displayCurrency: "BDT",
      }),
    ).toEqual({ amount: 10.63, currency: "EUR" });
  });

  it("suppresses a duplicate amount in the same currency", () => {
    expect(
      getAirwallexPaymentDisplay({
        paymentMethod: "AIRWALLEX",
        paymentAmount: 10.63,
        paymentCurrency: "EUR",
        displayAmount: 10.63,
        displayCurrency: "EUR",
      }),
    ).toBeNull();
  });

  it.each([
    [undefined, "EUR"],
    [Number.NaN, "EUR"],
    [0, "EUR"],
    [10.63, undefined],
    [10.63, "CAD"],
  ])(
    "rejects malformed runtime payment data (%j, %j)",
    (paymentAmount, paymentCurrency) => {
      expect(
        getAirwallexPaymentDisplay({
          paymentMethod: "AIRWALLEX",
          paymentAmount,
          paymentCurrency,
          displayAmount: 1_250,
          displayCurrency: "BDT",
        }),
      ).toBeNull();
    },
  );

  it("never treats another payment provider as an Airwallex charge", () => {
    expect(
      getAirwallexPaymentDisplay({
        paymentMethod: "SSLCOMMERZ",
        paymentAmount: 10.63,
        paymentCurrency: "EUR",
        displayAmount: 1_250,
        displayCurrency: "BDT",
      }),
    ).toBeNull();
  });
});
