import { describe, expect, it } from "vitest";
import { DEFAULT_CURRENCY_CONTEXT } from "@/lib/currency/config";
import { createAirwallexPaymentQuote, findAirwallexPaymentQuoteMismatch, quoteAirwallexPayment, resolveAirwallexPaymentCurrency } from "../services/airwallex-currency.service";

describe("USD Airwallex pricing", () => {
  it("uses canonical USD without exchange-rate requests", async () => {
    const quote = await quoteAirwallexPayment({ baseAmount: "24.99", displayContext: DEFAULT_CURRENCY_CONTEXT });
    expect(quote.baseCurrency).toBe("USD"); expect(quote.paymentCurrency).toBe("USD");
    expect(quote.paymentAmount.toFixed(2)).toBe("24.99"); expect(quote.exchangeRate.toString()).toBe("1");
    expect(resolveAirwallexPaymentCurrency("EUR")).toBe("USD");
  });
  it("rejects a forged non-parity exchange rate", () => {
    expect(() => createAirwallexPaymentQuote({ baseAmount: 25, displayCurrency: "USD", paymentRate: {
      baseCurrency: "USD", displayCurrency: "USD", paymentCurrency: "USD", exchangeRate: "2", exchangeRateTimestamp: new Date().toISOString(), stale: false,
    } })).toThrow("Invalid USD payment quote");
  });
  it("preserves historical BDT quotes when reconciling existing payments", () => {
    expect(findAirwallexPaymentQuoteMismatch({ canonicalBaseAmount: 1250, baseAmount: 1250, baseCurrency: "BDT", displayCurrency: "EUR", paymentAmount: "10.63", paymentCurrency: "EUR", exchangeRate: "0.0085", exchangeRateAt: "2026-08-22T11:58:00.000Z" })).toBeNull();
  });
});
