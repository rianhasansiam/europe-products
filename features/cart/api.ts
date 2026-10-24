import { readApiData } from "@/features/http/api-envelope";
import { createEventId, trackAddToCart } from "@/lib/analytics/meta-pixel";

export type CartStatus = "ACTIVE" | "INACTIVE";

export type CartItem = {
  id: string;
  productId: string;
  productCode?: string | null;
  slug?: string | null;
  variantId?: string | null;
  variantName?: string | null;
  sku?: string | null;
  color?: string | null;
  size?: string | null;
  attributes?: Record<string, string> | null;
  attributeSummary?: string | null;
  name: string;
  image: string | null;
  quantity: number;
  unitPrice: number;
  originalPrice: number;
  lineTotal: number;
  stock: number;
  status: CartStatus;
};

export type CartSummary = {
  totalItems: number;
  subtotal: number;
  totalDiscount: number;
  finalTotal: number;
};

export type CartSnapshot = {
  items: CartItem[];
  summary: CartSummary;
};

export function canUseServerCart(role: string | undefined, status: string): boolean {
  return status === "authenticated" && (role === "USER" || role === "ADMIN");
}

export async function fetchServerCartSnapshot(): Promise<CartSnapshot> {
  const response = await fetch("/api/cart", {
    method: "GET",
    cache: "no-store",
  });

  return readApiData<{ items: CartItem[]; summary: CartSummary }>(
    response,
    "Failed to load authoritative cart from server.",
  );
}

export async function createCartItemOnServer(
  productId: string,
  quantity = 1,
  variantId?: string | null,
  eventId = createEventId(),
): Promise<CartItem> {
  // Keep the submitted quantity/identity independent of the cumulative cart
  // row returned by the server and of later UI selection changes.
  const submittedQuantity = quantity;
  const response = await fetch("/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId,
      quantity,
      ...(variantId ? { variantId } : {}),
    }),
    cache: "no-store",
  });

  const item = await readApiData<CartItem>(response, "Failed to add item to cart.");
  if (response.headers.get("X-Store-Pricing-Ready") === "true") {
    trackAddToCart({ ...item, quantity: submittedQuantity }, eventId);
  }
  return item;
}

export async function addToCartOnServer(
  productId: string,
  quantity = 1,
  variantId?: string | null,
  eventId?: string,
): Promise<CartItem> {
  return createCartItemOnServer(productId, quantity, variantId, eventId);
}

export async function syncCartToServer(localItems: CartItem[]): Promise<CartSnapshot> {
  const response = await fetch("/api/cart", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: localItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        ...(item.variantId ? { variantId: item.variantId } : {}),
      })),
    }),
    cache: "no-store",
  });

  return readApiData<CartSnapshot>(response, "Failed to sync cart with server.");
}

export async function updateCartItemOnServer(
  itemId: string,
  quantity: number,
): Promise<CartItem> {
  const response = await fetch(`/api/cart/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity }),
    cache: "no-store",
  });

  return readApiData<CartItem>(response, "Failed to update cart item.");
}

export async function removeCartItemOnServer(itemId: string): Promise<{ id: string }> {
  const response = await fetch(`/api/cart/${itemId}`, {
    method: "DELETE",
    cache: "no-store",
  });

  return readApiData<{ id: string }>(response, "Failed to remove cart item.");
}

/**
 * Merge guest cart items into the authenticated user's server cart.
 *
 * Calls `POST /api/cart/merge` which adds guest quantities to existing
 * server rows (unlike sync which skips duplicates). Used by StoreHydrator
 * at login time.
 */
export async function mergeGuestCartToServer(
  localItems: CartItem[],
): Promise<CartSnapshot> {
  const response = await fetch("/api/cart/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: localItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        ...(item.variantId ? { variantId: item.variantId } : {}),
      })),
    }),
    cache: "no-store",
  });

  return readApiData<CartSnapshot>(response, "Failed to merge guest cart.");
}
