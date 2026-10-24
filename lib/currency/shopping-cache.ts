/** Browser-only readiness; never shared between server requests. */
declare global {
  interface Window { __sexToyUsdPricingReady?: boolean }
}

export function configureUsdShoppingCache(ready: boolean): void {
  if (typeof window !== "undefined") window.__sexToyUsdPricingReady = ready;
}

/** Fail closed until the provider has installed an explicitly reviewed state. */
export function canUseUsdShoppingCache(): boolean {
  return typeof window !== "undefined" && window.__sexToyUsdPricingReady === true;
}
