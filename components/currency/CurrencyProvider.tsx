"use client";

import { createContext, useContext, useLayoutEffect, type ReactNode } from "react";

import {
  DEFAULT_CURRENCY_CONTEXT,
  type CurrencyContext,
} from "@/lib/currency/config";

import { configureUsdShoppingCache } from "@/lib/currency/shopping-cache";

const CurrencyPresentationContext = createContext<CurrencyContext>(
  DEFAULT_CURRENCY_CONTEXT,
);

type CurrencyProviderProps = {
  children?: ReactNode;
  initialContext?: CurrencyContext;
};

/** Shares the fixed USD pricing state with client catalog UI. */
export function CurrencyProvider({
  children,
  initialContext = DEFAULT_CURRENCY_CONTEXT,
}: CurrencyProviderProps) {
  // Layout effects complete before descendant passive storage-hydration effects.
  useLayoutEffect(() => {
    configureUsdShoppingCache(initialContext.pricingReady === true);
    return () => configureUsdShoppingCache(false);
  }, [initialContext.pricingReady]);
  return (
    <CurrencyPresentationContext.Provider value={initialContext}>
      {children}
    </CurrencyPresentationContext.Provider>
  );
}

export function useCurrency(): CurrencyContext {
  return useContext(CurrencyPresentationContext);
}

export default CurrencyProvider;
