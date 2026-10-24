import type { CartItem } from "@/features/cart/api";
import type {
  CheckoutPreview,
  CheckoutSummary,
} from "@/features/checkout/api";

/** Canonical USD totals consumed by cart components that use CurrencyAmount. */
export type CanonicalCartSummary = {
  subtotalUSD: number;
  totalSavingsUSD: number;
  totalSavedUSD: number;
  discountUSD: number;
  shippingUSD: number;
  taxUSD: number;
  totalUSD: number;
  taxRate: number;
  freeShippingThresholdUSD: number;
  shippingFeeUSD: number;
  isOutsideDhaka: boolean;
  isFreeShippingApplied: boolean;
};

export type CartBootstrapState = {
  isHydrated: boolean;
  isLoading: boolean;
  sessionStatus: "loading" | "authenticated" | "unauthenticated";
};

/** Hide cart content until client storage or the active server sync is ready. */
export function shouldShowCartBootstrap({
  isHydrated,
  isLoading,
  sessionStatus,
}: CartBootstrapState): boolean {
  return !isHydrated && (sessionStatus === "loading" || isLoading);
}

/**
 * Keep server-verified cart amounts in the single USD pricing currency.
 */
export function toCanonicalCartSummary(
  summary: CheckoutSummary,
): CanonicalCartSummary {
  return {
    subtotalUSD: summary.baseSubtotal,
    totalSavingsUSD: summary.baseTotalSavings,
    totalSavedUSD: summary.baseTotalSaved,
    discountUSD: summary.baseDiscount,
    shippingUSD: summary.baseShipping,
    taxUSD: summary.baseTax,
    totalUSD: summary.baseTotal,
    taxRate: summary.taxRate,
    freeShippingThresholdUSD: summary.baseFreeShippingThreshold,
    shippingFeeUSD: summary.baseShippingFee,
    isOutsideDhaka: summary.isOutsideDhaka,
    isFreeShippingApplied: summary.isFreeShippingApplied,
  };
}

/** Merge authoritative preview details without storing display-currency money. */
export function mergeCartItemWithCheckoutPreview(
  item: CartItem,
  preview: CheckoutPreview | null,
): CartItem {
  const priced = preview?.items.find((candidate) =>
    item.variantId
      ? candidate.variantId === item.variantId
      : candidate.productId === item.productId,
  );
  if (!priced) return item;

  return {
    ...item,
    productId: priced.productId,
    productCode: priced.productCode ?? item.productCode,
    variantId: priced.variantId,
    sku: priced.sku,
    variantName: priced.variantName,
    color: priced.color,
    size: priced.size,
    attributes: priced.attributes,
    attributeSummary: priced.attributeSummary,
    name: priced.name,
    image: priced.image ?? item.image,
    unitPrice: priced.baseUnitPrice,
    originalPrice: priced.baseOriginalPrice,
    lineTotal: priced.baseLineTotal,
    stock: priced.stock,
    status: "ACTIVE",
  };
}
