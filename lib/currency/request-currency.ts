import "server-only";

import { getStoreSettingsCached } from "@/lib/services/settings.service";
import { isUsdPricingReady } from "./pricing-readiness";
import { createPricingContext } from "./pricing.service";
import type { CurrencyContext } from "./config";

/** Fixed USD presentation; the database review gate prevents relabeling legacy prices. */
export async function getRequestCurrencyContext(): Promise<CurrencyContext> {
  try {
    const settings = await getStoreSettingsCached();
    return createPricingContext({ pricingReady: isUsdPricingReady(settings) });
  } catch {
    return createPricingContext({ pricingReady: false });
  }
}

/** No request headers, cookies, IP address, or location influence currency. */
export function getCurrencyContextFromRequest(_request?: Request): Promise<CurrencyContext> {
  void _request;
  return getRequestCurrencyContext();
}

export function getBaseCurrencyContext(): CurrencyContext {
  return createPricingContext();
}
