import "server-only";

import { BASE_CURRENCY } from "./config";
import { ServiceError } from "@/lib/services/service-error";

export type PricingReadinessSettings = {
  currency: string;
  pricingCurrencyVerified?: boolean;
};

export function isUsdPricingReady(settings: PricingReadinessSettings | null | undefined): boolean {
  return settings?.currency === BASE_CURRENCY && settings.pricingCurrencyVerified === true;
}

/** Never turn existing BDT catalog values into USD merely by changing a label. */
export function assertUsdPricingReady(settings: PricingReadinessSettings | null | undefined): void {
  if (!isUsdPricingReady(settings)) {
    throw new ServiceError(503, "Checkout is temporarily unavailable while USD pricing is reviewed.", { code: "USD_PRICING_REVIEW_REQUIRED" });
  }
}
