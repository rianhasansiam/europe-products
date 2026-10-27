import { describe, expect, it } from "vitest";
import { BASE_CURRENCY, DEFAULT_CURRENCY_CONTEXT, HISTORICAL_CURRENCIES, SUPPORTED_CURRENCIES, isCurrencyCode, parseCurrencyCode } from "@/lib/currency/config";
import { formatMoney } from "@/lib/currency/format-money";
import { createPricingContext, normalizePrice, priceAmount } from "@/lib/currency/pricing.service";

describe("USD transaction policy", () => {
  it("accepts only USD for new financial input", () => {
    expect(BASE_CURRENCY).toBe("USD");
    expect(SUPPORTED_CURRENCIES).toEqual(["USD"]);
    expect(parseCurrencyCode("USD")).toBe("USD");
    for (const value of ["BDT", "EUR", "GBP", "AUD", "CNY", "usd", " USD ", null]) {
      expect(isCurrencyCode(value)).toBe(false);
      expect(parseCurrencyCode(value)).toBeNull();
    }
  });
  it("ignores client currency, rates and location instead of converting USD amounts", () => {
    const context = createPricingContext({ currency: "BDT", exchangeRate: "0.0082", countryCode: "BD", source: "geo" });
    expect(context).toEqual(DEFAULT_CURRENCY_CONTEXT);
    expect(priceAmount({ baseAmount: "50.005", context })).toMatchObject({ currency: "USD", amount: 50.01, baseAmount: 50.01, exchangeRate: "1" });
    expect(normalizePrice({ amount: "50.005", context })).toBe(50.01);
  });
  it("makes catalog prices available without accepting an archived review state", () => {
    expect(createPricingContext({ pricingReady: false })).toMatchObject({ currency: "USD", pricingReady: true });
  });
  it.each([-1, "NaN", "Infinity", "invalid"])("rejects invalid price %s", (amount) => {
    expect(() => normalizePrice({ amount })).toThrow();
  });
});

describe("historical money presentation", () => {
  it.each(HISTORICAL_CURRENCIES)("formats stored %s amounts without relabeling or conversion", (currency) => {
    expect(formatMoney(1234.56, currency)).toBe(new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(1234.56));
  });
});
