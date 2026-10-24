import { canUseUsdShoppingCache } from "@/lib/currency/shopping-cache";
import { asRecord } from "@/features/http/api-envelope";
import type { CartItem } from "@/features/cart/api";

// Separate USD caches from legacy BDT values; leave the old browser data intact.
export const CART_LOCAL_STORAGE_KEY = "sextoy:cart:usd:v1";
export const DEFAULT_CART_STOCK = 10;

function normalizeAttributes(value: unknown): Record<string, string> | null {
  const record = asRecord(value);
  if (!record) return null;
  const entries = Object.entries(record).filter(
    (entry): entry is [string, string] =>
      entry[0].trim().length > 0 &&
      typeof entry[1] === "string" &&
      entry[1].trim().length > 0,
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

/** A cart line is uniquely identified by its variant when present,
 * otherwise by its product (single-variant / legacy items). */
export function cartItemKey(item: {
  productId: string;
  variantId?: string | null;
}): string {
  return item.variantId ? `variant:${item.variantId}` : `product:${item.productId}`;
}

export function normalizeCartItem(
  raw: unknown,
  fallbackStock = DEFAULT_CART_STOCK,
): CartItem | null {
  const entry = asRecord(raw);
  if (!entry) return null;

  const id = typeof entry.id === "string" ? entry.id : "";
  const productIdFromEntry =
    typeof entry.productId === "string" ? entry.productId : "";
  const productId = productIdFromEntry || id;
  const name = typeof entry.name === "string" ? entry.name : "";
  if (!productId || !name) return null;

  const quantityRaw =
    typeof entry.quantity === "number" && Number.isFinite(entry.quantity)
      ? entry.quantity
      : 1;
  const requestedQuantity = Math.max(1, Math.round(quantityRaw));

  const unitPrice =
    typeof entry.unitPrice === "number" && Number.isFinite(entry.unitPrice)
      ? entry.unitPrice
      : typeof entry.price === "number" && Number.isFinite(entry.price)
        ? entry.price
        : 0;

  const originalPrice =
    typeof entry.originalPrice === "number" && Number.isFinite(entry.originalPrice)
      ? entry.originalPrice
      : unitPrice;

  const stockRaw =
    typeof entry.stock === "number" && Number.isFinite(entry.stock)
      ? entry.stock
      : typeof entry.maxQuantity === "number" && Number.isFinite(entry.maxQuantity)
        ? entry.maxQuantity
        : fallbackStock;
  const stock = Math.max(0, Math.round(stockRaw));
  const quantity = stock > 0 ? Math.min(requestedQuantity, stock) : 1;

  const attributes = normalizeAttributes(entry.attributes ?? entry.variantAttributes);
  const attributeSummary =
    typeof entry.attributeSummary === "string" && entry.attributeSummary.trim()
      ? entry.attributeSummary
      : attributes
        ? Object.entries(attributes)
            .map(([key, value]) => `${key}: ${value}`)
            .join(" · ")
        : null;

  return {
    id: id || `local:${productId}`,
    productId,
    productCode:
      typeof entry.productCode === "string" ? entry.productCode : null,
    slug: typeof entry.slug === "string" && entry.slug ? entry.slug : null,
    variantId: typeof entry.variantId === "string" ? entry.variantId : null,
    variantName:
      typeof entry.variantName === "string" ? entry.variantName : null,
    sku: typeof entry.sku === "string" ? entry.sku : null,
    color: typeof entry.color === "string" ? entry.color : null,
    size: typeof entry.size === "string" ? entry.size : null,
    attributes,
    attributeSummary,
    name,
    image: typeof entry.image === "string" && entry.image ? entry.image : null,
    quantity,
    unitPrice,
    originalPrice,
    lineTotal: unitPrice * quantity,
    stock,
    status: entry.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
  };
}

export function readLocalCart(options?: { dedupeByProductId?: boolean }): CartItem[] {
  if (!canUseUsdShoppingCache()) return [];

  const raw = window.localStorage.getItem(CART_LOCAL_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const items = parsed
      .map((item) => normalizeCartItem(item))
      .filter((item): item is CartItem => item !== null);

    if (!options?.dedupeByProductId) return items;

    // Dedupe by variant (falls back to product for legacy items).
    const deduped = new Map<string, CartItem>();
    for (const item of items) {
      const key = cartItemKey(item);
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, item);
        continue;
      }

      const stock = Math.min(existing.stock, item.stock);
      const quantity =
        stock > 0
          ? Math.min(existing.quantity + item.quantity, stock)
          : 1;
      deduped.set(key, {
        ...existing,
        quantity,
        lineTotal: existing.unitPrice * quantity,
        stock,
      });
    }

    return Array.from(deduped.values());
  } catch {
    return [];
  }
}

export function writeLocalCart(items: CartItem[]) {
  if (!canUseUsdShoppingCache()) return;
  window.localStorage.setItem(CART_LOCAL_STORAGE_KEY, JSON.stringify(items));
}

export function upsertLocalCartItem(list: CartItem[], item: CartItem): CartItem[] {
  const availableStock = Math.max(0, Math.round(item.stock));
  if (availableStock === 0) return list;

  const key = cartItemKey(item);
  const index = list.findIndex((entry) => cartItemKey(entry) === key);
  if (index === -1) {
    const quantity = Math.min(Math.max(1, item.quantity), availableStock);
    return [
      {
        ...item,
        quantity,
        lineTotal: item.unitPrice * quantity,
        stock: availableStock,
      },
      ...list,
    ];
  }

  const existing = list[index];
  const quantity = Math.min(
    existing.quantity + Math.max(1, item.quantity),
    availableStock,
  );
  const next: CartItem = {
    ...existing,
    ...item,
    image: item.image ?? existing.image,
    quantity,
    lineTotal: item.unitPrice * quantity,
    stock: availableStock,
  };

  const merged = [...list];
  merged[index] = next;
  return merged;
}
