import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CURRENCY_CONTEXT } from "@/lib/currency/config";
import { getCurrencyContextFromRequest, getRequestCurrencyContext } from "@/lib/currency/request-currency";
import { getStoreSettingsCached } from "@/lib/services/settings.service";
vi.mock("@/lib/services/settings.service", () => ({ getStoreSettingsCached: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

describe("fixed server currency", () => {
  it("never reads the IP country or currency cookie", async () => {
    const result = await getCurrencyContextFromRequest(new Request("https://sextoybd.net", { headers: { "cf-ipcountry": "DE", cookie: "currency=EUR" } }));
    expect(result).toEqual(DEFAULT_CURRENCY_CONTEXT);
  });
  it("presents catalog prices without consulting a legacy review flag", async () => {
    const legacySettings = {
      id: "settings", currency: "BDT", pricingCurrencyVerified: false,
      taxRate: 0, standardShippingFee: 0, expressShippingFee: 0, freeShippingThreshold: 0,
      createdAt: new Date(), updatedAt: new Date(),
    };
    vi.mocked(getStoreSettingsCached).mockResolvedValue(legacySettings);
    expect(await getRequestCurrencyContext()).toEqual(DEFAULT_CURRENCY_CONTEXT);
    expect(getStoreSettingsCached).not.toHaveBeenCalled();
  });
  it("does not require a settings lookup to format catalog prices", async () => {
    vi.mocked(getStoreSettingsCached).mockRejectedValue(new Error("database unavailable"));
    expect(await getRequestCurrencyContext()).toEqual(DEFAULT_CURRENCY_CONTEXT);
    expect(getStoreSettingsCached).not.toHaveBeenCalled();
  });
});
