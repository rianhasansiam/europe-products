import { readApiData } from "@/features/http/api-envelope";

export type WishlistItem = {
  id: string;
  productCode?: string | null;
  slug?: string;
  name: string;
  brand: string;
  image: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  category: string;
  inStock: boolean;
  addedAt: string;
  priceDropFromAdded?: number;
  badge?: string;
  /** Purchasable variant count; when > 1 the customer must pick options. */
  variantCount?: number;
};

export function isServerWishlistRole(role: string | undefined): boolean {
  return role === "USER" || role === "ADMIN";
}

export function canUseServerWishlist(
  role: string | undefined,
  status: string,
): boolean {
  return status === "authenticated" && isServerWishlistRole(role);
}

export async function syncWishlistToServer(
  productIds: string[],
): Promise<WishlistItem[]> {
  const response = await fetch("/api/wishlist", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productIds }),
    cache: "no-store",
  });

  return readApiData<WishlistItem[]>(
    response,
    "Failed to sync wishlist with server.",
  );
}

export async function createWishlistItemOnServer(
  productId: string,
): Promise<WishlistItem> {
  const response = await fetch("/api/wishlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId }),
    cache: "no-store",
  });

  return readApiData<WishlistItem>(
    response,
    "Failed to add this product to wishlist.",
  );
}

export async function removeWishlistItemOnServer(productId: string): Promise<void> {
  const response = await fetch(`/api/wishlist/${productId}`, {
    method: "DELETE",
    cache: "no-store",
  });

  await readApiData<{ id: string }>(
    response,
    "Failed to remove this product from wishlist.",
  );
}

/**
 * Fetch the authenticated user's wishlist from the server.
 */
export async function fetchServerWishlist(): Promise<WishlistItem[]> {
  const response = await fetch("/api/wishlist", {
    method: "GET",
    cache: "no-store",
  });

  return readApiData<WishlistItem[]>(
    response,
    "Failed to load wishlist from server.",
  );
}

/**
 * Merge guest wishlist product IDs into the authenticated user's
 * server wishlist. Duplicates are skipped automatically.
 * Used by StoreHydrator at login time.
 */
export async function mergeGuestWishlistToServer(
  productIds: string[],
): Promise<WishlistItem[]> {
  const response = await fetch("/api/wishlist/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productIds }),
    cache: "no-store",
  });

  return readApiData<WishlistItem[]>(
    response,
    "Failed to merge guest wishlist.",
  );
}
