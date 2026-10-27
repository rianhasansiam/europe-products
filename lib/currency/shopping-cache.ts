/** Browser-only readiness; never shared between server requests. */
declare global {
  interface Window { __sexToyUsdPricingReady?: boolean }
}

export function configureUsdShoppingCache(ready: boolean): void {
  if (typeof window !== "undefined") window.__sexToyUsdPricingReady = ready;
}

/** Wait for the USD provider before reading or persisting browser price snapshots. */
export function canUseUsdShoppingCache(): boolean {
  return typeof window !== "undefined" && window.__sexToyUsdPricingReady === true;
}
