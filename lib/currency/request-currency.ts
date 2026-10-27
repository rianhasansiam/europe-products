import "server-only";

import { createPricingContext } from "./pricing.service";
import type { CurrencyContext } from "./config";

/** Current catalog prices use USD without a separate approval step. */
export async function getRequestCurrencyContext(): Promise<CurrencyContext> {
  return createPricingContext();
}

/** No request headers, cookies, IP address, or location influence currency. */
export function getCurrencyContextFromRequest(_request?: Request): Promise<CurrencyContext> {
  void _request;
  return getRequestCurrencyContext();
}

export function getBaseCurrencyContext(): CurrencyContext {
  return createPricingContext();
}
