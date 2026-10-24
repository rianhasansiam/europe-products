import { canUseUsdShoppingCache } from "@/lib/currency/shopping-cache";
import { asRecord } from "@/features/http/api-envelope";
import type { WishlistItem } from "@/features/wishlist/api";

// Separate USD caches from legacy BDT values; leave the old browser data intact.
export const WISHLIST_LOCAL_STORAGE_KEY = "sextoy:wishlist:usd:v1";

export function normalizeWishlistItem(raw: unknown): WishlistItem | null {
  const entry = asRecord(raw);
  if (!entry) return null;
  if (typeof entry.id !== "string" || entry.id.trim() === "") return null;
  if (typeof entry.name !== "string" || entry.name.trim() === "") return null;

  const price =
    typeof entry.price === "number" && Number.isFinite(entry.price)
      ? entry.price
      : 0;
  const originalPrice =
    typeof entry.originalPrice === "number" && Number.isFinite(entry.originalPrice)
      ? entry.originalPrice
      : undefined;
  const rating =
    typeof entry.rating === "number" && Number.isFinite(entry.rating)
      ? entry.rating
      : 0;
  const reviewCount =
    typeof entry.reviewCount === "number" && Number.isFinite(entry.reviewCount)
      ? entry.reviewCount
      : 0;
  const addedAt =
    typeof entry.addedAt === "string" && entry.addedAt
      ? entry.addedAt
      : new Date().toISOString();

  return {
    id: entry.id,
    productCode:
      typeof entry.productCode === "string" ? entry.productCode : null,
    slug: typeof entry.slug === "string" && entry.slug ? entry.slug : undefined,
    name: entry.name,
    brand: typeof entry.brand === "string" && entry.brand ? entry.brand : "SexToy",
    image: typeof entry.image === "string" && entry.image ? entry.image : "",
    price,
    originalPrice,
    rating,
    reviewCount,
    category:
      typeof entry.category === "string" && entry.category ? entry.category : "General",
    inStock: typeof entry.inStock === "boolean" ? entry.inStock : true,
    addedAt,
    priceDropFromAdded:
      typeof entry.priceDropFromAdded === "number" &&
      Number.isFinite(entry.priceDropFromAdded)
        ? entry.priceDropFromAdded
        : undefined,
    badge: typeof entry.badge === "string" && entry.badge ? entry.badge : undefined,
    variantCount:
      typeof entry.variantCount === "number" && Number.isFinite(entry.variantCount)
        ? Math.max(0, Math.round(entry.variantCount))
        : undefined,
  };
}

export function readLocalWishlist(): WishlistItem[] {
  if (!canUseUsdShoppingCache()) return [];

  const raw = window.localStorage.getItem(WISHLIST_LOCAL_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const normalized = parsed
      .map(normalizeWishlistItem)
      .filter((item): item is WishlistItem => item !== null);

    const seen = new Set<string>();
    return normalized.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  } catch {
    return [];
  }
}

export function writeLocalWishlist(items: WishlistItem[]) {
  if (!canUseUsdShoppingCache()) return;
  window.localStorage.setItem(WISHLIST_LOCAL_STORAGE_KEY, JSON.stringify(items));
}

export function upsertLocalWishlistItem(
  list: WishlistItem[],
  item: WishlistItem,
): WishlistItem[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) {
    return [item, ...list];
  }

  const next = [...list];
  next[index] = { ...next[index], ...item };
  return next;
}
