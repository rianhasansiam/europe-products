import { canUseUsdShoppingCache } from "@/lib/currency/shopping-cache";
/**
 * saved-storage.ts
 *
 * Shared helpers for the "Saved for later" list that is stored in
 * localStorage and rendered on both the Cart and Wishlist pages.
 */

import { asRecord } from "@/features/http/api-envelope";

// Separate USD caches from legacy BDT values; leave the old browser data intact.
export const SAVED_LOCAL_STORAGE_KEY = "sextoy:saved-for-later:usd:v1";

const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400";

export type SavedItem = {
  id: string;
  productId: string;
  productCode?: string | null;
  slug: string;
  variantId?: string | null;
  sku?: string | null;
  variantName?: string | null;
  color?: string | null;
  size?: string | null;
  attributes?: Record<string, string> | null;
  attributeSummary?: string | null;
  name: string;
  image: string;
  price: number;
  originalPrice?: number;
  inStock: boolean;
};

export function normalizeSavedItem(raw: unknown): SavedItem | null {
  const entry = asRecord(raw);
  if (!entry) return null;

  const id = typeof entry.id === "string" ? entry.id : "";
  const productIdFromEntry =
    typeof entry.productId === "string" ? entry.productId : "";
  const productId = productIdFromEntry || id;
  const name = typeof entry.name === "string" ? entry.name : "";
  const image = typeof entry.image === "string" ? entry.image : "";

  if (!productId || !name) return null;

  const price =
    typeof entry.price === "number" && Number.isFinite(entry.price)
      ? entry.price
      : 0;

  const originalPrice =
    typeof entry.originalPrice === "number" &&
    Number.isFinite(entry.originalPrice)
      ? entry.originalPrice
      : undefined;

  const attributesRecord = asRecord(entry.attributes);
  const attributes = attributesRecord
    ? Object.fromEntries(
        Object.entries(attributesRecord).filter(
          (item): item is [string, string] => typeof item[1] === "string",
        ),
      )
    : null;

  return {
    id: id || `saved:${productId}`,
    productId,
    productCode:
      typeof entry.productCode === "string" ? entry.productCode : null,
    slug: typeof entry.slug === "string" && entry.slug ? entry.slug : productId,
    variantId: typeof entry.variantId === "string" ? entry.variantId : null,
    sku: typeof entry.sku === "string" ? entry.sku : null,
    variantName:
      typeof entry.variantName === "string" ? entry.variantName : null,
    color: typeof entry.color === "string" ? entry.color : null,
    size: typeof entry.size === "string" ? entry.size : null,
    attributes,
    attributeSummary:
      typeof entry.attributeSummary === "string" ? entry.attributeSummary : null,
    name,
    image: image || FALLBACK_PRODUCT_IMAGE,
    price,
    originalPrice,
    inStock: typeof entry.inStock === "boolean" ? entry.inStock : true,
  };
}

export function readLocalSaved(): SavedItem[] {
  if (!canUseUsdShoppingCache()) return [];

  const raw = window.localStorage.getItem(SAVED_LOCAL_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeSavedItem)
      .filter((item): item is SavedItem => item !== null);
  } catch {
    return [];
  }
}

export function writeLocalSaved(items: SavedItem[]): void {
  if (!canUseUsdShoppingCache()) return;
  window.localStorage.setItem(
    SAVED_LOCAL_STORAGE_KEY,
    JSON.stringify(items),
  );
}
