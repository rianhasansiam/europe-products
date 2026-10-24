const MIN_PROMO_LENGTH = 2;
const MAX_PROMO_LENGTH = 40;

export function normalizeCheckoutPromoCode(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (
    normalized.length < MIN_PROMO_LENGTH ||
    normalized.length > MAX_PROMO_LENGTH
  ) {
    return null;
  }

  return normalized;
}

export function buildCheckoutHref(promoCode?: string | null): string {
  const normalized = normalizeCheckoutPromoCode(promoCode);
  if (!normalized) return "/checkout";

  const params = new URLSearchParams({ promo: normalized });
  return `/checkout?${params.toString()}`;
}

type CartSelectionItem = {
  productId: string;
  variantId?: string | null;
  quantity: number;
};

export function buildCartSelectionCheckoutHref(
  items: CartSelectionItem[],
  promoCode?: string | null,
): string {
  const serializedItems = items
    .map((item) => {
      const quantity = Number.isFinite(item.quantity)
        ? Math.max(1, Math.trunc(item.quantity))
        : 1;
      return [item.productId, quantity, item.variantId ?? ""].join(":");
    })
    .join(",");
  const params = new URLSearchParams({
    buy: serializedItems,
    source: "cart",
  });
  const normalizedPromo = normalizeCheckoutPromoCode(promoCode);
  if (normalizedPromo) params.set("promo", normalizedPromo);

  return `/checkout?${params.toString()}`;
}
