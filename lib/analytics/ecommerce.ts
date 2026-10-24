import { isHistoricalCurrencyCode, type CurrencyCode } from "@/lib/currency/config";
import { roundDecimalHalfUp } from "@/lib/currency/decimal";

/** Numeric major units in the snapshot currency, never formatted money. */
export type CommerceItem = {
  productId: string;
  productCode?: string | null;
  variantId?: string | null;
  sku?: string | null;
  name?: string;
  quantity: number;
  unitPrice: number;
  stock?: number;
  status?: string;
};

export type CommerceSnapshot = {
  items: readonly CommerceItem[];
  currency: CurrencyCode;
  value: number;
};

export type EcommercePayload = {
  content_ids: string[];
  content_type: "product";
  contents: { id: string; quantity: number; item_price: number }[];
  content_name?: string;
  variant_ids?: string[];
  value: number;
  currency: CurrencyCode;
  num_items: number;
};

function validAmount(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && Number.isSafeInteger(Math.round(value * 100));
}

/** Match existing PDP retailer_item_id; legacy persisted carts lack productCode. */
export function catalogContentId(item: CommerceItem): string {
  return (typeof item.productCode === "string" ? item.productCode.trim() : "") ||
    (typeof item.productId === "string" ? item.productId.trim() : "");
}

/** Pure payload construction, independent of the browser and delivery. */
export function buildEcommercePayload(
  items: readonly CommerceItem[],
  currency: CurrencyCode,
  value?: number,
): EcommercePayload | null {
  if (!items.length || !isHistoricalCurrencyCode(currency)) return null;
  if (items.some((item) => !catalogContentId(item) || !Number.isSafeInteger(item.quantity) || item.quantity <= 0 || !validAmount(item.unitPrice))) return null;
  const contents = items.map((item) => ({
    id: catalogContentId(item),
    quantity: item.quantity,
    item_price: roundDecimalHalfUp(item.unitPrice, 2),
  }));
  const total = value ?? contents.reduce((sum, item) => sum + item.item_price * item.quantity, 0);
  const numItems = contents.reduce((sum, item) => sum + item.quantity, 0);
  if (!validAmount(total) || !Number.isSafeInteger(numItems)) return null;
  const variants = items.map((item) => item.variantId?.trim()).filter((id): id is string => !!id);
  return {
    content_ids: [...new Set(contents.map((item) => item.id))],
    content_type: "product",
    contents,
    ...(items.length === 1 && items[0].name ? { content_name: items[0].name } : {}),
    ...(variants.length ? { variant_ids: [...new Set(variants)] } : {}),
    value: roundDecimalHalfUp(total, 2),
    currency,
    num_items: numItems,
  };
}

/** Guest stock caps mean only the newly committed quantity counts. */
export function localCartAddedItems(before: readonly CommerceItem[], after: readonly CommerceItem[]): CommerceItem[] {
  const key = (item: CommerceItem) => item.variantId ? `variant:${item.variantId}` : `product:${item.productId}`;
  const previous = new Map(before.map((item) => [key(item), item.quantity]));
  return after.flatMap((item) => {
    if (item.status === "INACTIVE") return [];
    if (item.stock != null && (!Number.isFinite(item.stock) || item.stock <= 0 || item.quantity > item.stock)) return [];
    const quantity = item.quantity - (previous.get(key(item)) ?? 0);
    return quantity > 0 ? [{ ...item, quantity }] : [];
  });
}
