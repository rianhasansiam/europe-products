import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "./helpers/intl";
import { describe, expect, it } from "vitest";

import FreeShippingBar from "@/app/(shop)/cart/components/FreeShippingBar";
import OrderSummary from "@/app/(shop)/cart/components/OrderSummary";
import { CurrencyAmount } from "@/components/currency/CurrencyAmount";
import CurrencyProvider from "@/components/currency/CurrencyProvider";
import type { CartItem } from "@/features/cart/api";
import {
  mergeCartItemWithCheckoutPreview,
  shouldShowCartBootstrap,
  toCanonicalCartSummary,
} from "@/features/cart/checkout-preview";
import type { CheckoutPreview } from "@/features/checkout/api";
import { createPricingContext } from "@/lib/currency/pricing.service";

const usdContext = createPricingContext({
  currency: "USD",
  exchangeRate: "1",
  exchangeRateTimestamp: "2026-08-25T00:00:00.000Z",
  countryCode: "US",
  source: "fixed",
});

const preview: CheckoutPreview = {
  items: [
    {
      productId: "product-1",
      variantId: "variant-1",
      sku: "SKU-1",
      variantKey: "default",
      variantName: "Default",
      modelNumber: null,
      color: null,
      size: null,
      attributes: null,
      attributeSummary: null,
      name: "Test product",
      image: null,
      quantity: 2,
      unitPrice: 50,
      originalPrice: 55,
      lineTotal: 100,
      lineSavings: 10,
      baseUnitPrice: 50,
      baseOriginalPrice: 55,
      baseLineTotal: 100,
      baseLineSavings: 10,
      stock: 10,
    },
  ],
  summary: {
    subtotal: 100,
    totalSavings: 10,
    totalSaved: 15,
    discount: 5,
    shipping: 1,
    tax: 9.5,
    total: 105.5,
    taxRate: 0.1,
    freeShippingThreshold: 150,
    shippingFee: 1,
    isOutsideDhaka: false,
    isFreeShippingApplied: false,
    currency: "USD",
    baseCurrency: "USD",
    baseSubtotal: 100,
    baseTotalSavings: 10,
    baseTotalSaved: 15,
    baseDiscount: 5,
    baseShipping: 1,
    baseTax: 9.5,
    baseTotal: 105.5,
    baseFreeShippingThreshold: 150,
    baseShippingFee: 1,
    exchangeRate: "1",
    exchangeRateTimestamp: "2026-08-25T00:00:00.000Z",
  },
  promo: {
    ok: true,
    code: "SAVE5",
    description: null,
    discount: 5,
    baseDiscount: 5,
  },
  airwallexPaymentQuote: null,
  availablePaymentMethods: ["AIRWALLEX"],
};

function renderWithCurrency(children: ReactNode): string {
  return renderToStaticMarkup(
    createElement(CurrencyProvider, { initialContext: usdContext }, children),
  );
}

function textContent(markup: string): string {
  return markup.replace(/<[^>]*>/g, "");
}

describe("cart currency display", () => {
  it("renders USD amounts without conversion on the first markup", () => {
    const markup = renderWithCurrency(
      createElement(CurrencyAmount, { amountUSD: 50 }),
    );

    expect(markup).toContain("$50.00");
    expect(markup).not.toContain("BDT");
  });

  it("keeps cart content behind its loader until hydration completes", () => {
    expect(
      shouldShowCartBootstrap({
        isHydrated: false,
        isLoading: false,
        sessionStatus: "loading",
      }),
    ).toBe(true);
    expect(
      shouldShowCartBootstrap({
        isHydrated: false,
        isLoading: true,
        sessionStatus: "authenticated",
      }),
    ).toBe(true);
    expect(
      shouldShowCartBootstrap({
        isHydrated: true,
        isLoading: true,
        sessionStatus: "authenticated",
      }),
    ).toBe(false);
    expect(
      shouldShowCartBootstrap({
        isHydrated: false,
        isLoading: false,
        sessionStatus: "unauthenticated",
      }),
    ).toBe(false);
  });

  it("keeps checkout preview money canonical inside the cart", () => {
    const cartItem: CartItem = {
      id: "cart-1",
      productId: "product-1",
      variantId: "variant-1",
      name: "Stale product name",
      image: null,
      quantity: 2,
      unitPrice: 49,
      originalPrice: 54,
      lineTotal: 98,
      stock: 8,
      status: "ACTIVE",
    };

    const merged = mergeCartItemWithCheckoutPreview(cartItem, preview);

    expect(merged).toMatchObject({
      name: "Test product",
      unitPrice: 50,
      originalPrice: 55,
      lineTotal: 100,
      stock: 10,
    });
    expect(merged.unitPrice).toBe(preview.items[0].unitPrice);
    expect(cartItem.unitPrice).toBe(49);
  });

  it("projects every verified summary value from its USD base field", () => {
    expect(toCanonicalCartSummary(preview.summary)).toEqual({
      subtotalUSD: 100,
      totalSavingsUSD: 10,
      totalSavedUSD: 15,
      discountUSD: 5,
      shippingUSD: 1,
      taxUSD: 9.5,
      totalUSD: 105.5,
      taxRate: 0.1,
      freeShippingThresholdUSD: 150,
      shippingFeeUSD: 1,
      isOutsideDhaka: false,
      isFreeShippingApplied: false,
    });
  });

  it("formats verified USD cart totals without conversion", () => {
    const markup = renderWithCurrency(
      createElement(OrderSummary, {
        summary: toCanonicalCartSummary(preview.summary),
        fallbackSubtotalUSD: 100,
        itemCount: 2,
        promo: {
          code: "SAVE5",
          discountUSD: 5,
          description: null,
        },
        promoError: null,
        onApplyPromo: () => undefined,
        onRemovePromo: () => undefined,
        onPromoErrorClear: () => undefined,
        onCheckout: () => undefined,
      }),
    );
    const text = textContent(markup);

    expect(text).toContain("$100.00");
    expect(text).toContain("-$5.00");
    expect(text).toContain("$1.00");
    expect(text).toContain("$9.50");
    expect(text).toContain("$105.50");
    expect(text).toContain("$15.00");
    expect(text).not.toContain("$1.06");
  });

  it("formats the USD free-shipping remainder", () => {
    const markup = renderWithCurrency(
      createElement(FreeShippingBar, {
        subtotalUSD: 100,
        thresholdUSD: 150,
      }),
    );

    expect(textContent(markup)).toContain("Add $50.00 more");
    expect(textContent(markup)).not.toContain("$0.50");
  });
});
