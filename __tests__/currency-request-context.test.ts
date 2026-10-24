import { describe, expect, it, vi } from "vitest";
import { getCurrencyContextFromRequest, getRequestCurrencyContext } from "@/lib/currency/request-currency";
import { getStoreSettingsCached } from "@/lib/services/settings.service";
vi.mock("@/lib/services/settings.service", () => ({ getStoreSettingsCached: vi.fn() }));

describe("fixed server currency", () => {
  it("never reads the IP country or currency cookie", async () => {
    vi.mocked(getStoreSettingsCached).mockResolvedValue({ currency: "USD", pricingCurrencyVerified: true } as Awaited<ReturnType<typeof getStoreSettingsCached>>);
    const result = await getCurrencyContextFromRequest(new Request("https://sextoybd.com", { headers: { "cf-ipcountry": "DE", cookie: "currency=EUR" } }));
    expect(result).toMatchObject({ currency: "USD", exchangeRate: "1", countryCode: null, source: "fixed", pricingReady: true });
  });
  it("hides prices for an unreviewed legacy catalog", async () => {
    vi.mocked(getStoreSettingsCached).mockResolvedValue({ currency: "BDT", pricingCurrencyVerified: false } as Awaited<ReturnType<typeof getStoreSettingsCached>>);
    expect(await getRequestCurrencyContext()).toMatchObject({ currency: "USD", pricingReady: false });
  });
  it("fails closed if settings cannot be loaded", async () => {
    vi.mocked(getStoreSettingsCached).mockRejectedValue(new Error("database unavailable"));
    expect(await getRequestCurrencyContext()).toMatchObject({ pricingReady: false });
  });
});
