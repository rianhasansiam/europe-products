import { z } from "zod";

/**
 * Zod schemas for the Cart API.
 *
 * Notes:
 *  - Frontend sends `productId` and `quantity` only. Price, discount,
 *    stock, and status are all read from the DB inside the service.
 *  - Quantity is bounded so callers can't spam huge integers; the
 *    real (per-product) cap is enforced against `Product.stock` later.
 */

const productId = z.string().trim().min(1, "Product is required.");

const variantId = z.string().trim().min(1, "Variant is required.");

const quantity = z
  .number({ error: "Quantity must be a number." })
  .int("Quantity must be a whole number.")
  .positive("Quantity must be at least 1.")
  .max(1000, "Quantity is too large.");

/** Body for `POST /api/cart`. */
export const addToCartSchema = z.object({
  productId,
  // Optional: when omitted the service falls back to the product's
  // primary (first) variant so existing single-variant flows keep working.
  variantId: variantId.optional(),
  quantity: quantity.default(1),
});

const syncCartItemSchema = z.object({
  productId,
  variantId: variantId.optional(),
  quantity,
});

/** Body for `PUT /api/cart`. */
export const syncCartSchema = z.object({
  items: z.array(syncCartItemSchema).max(200, "Too many cart items."),
});

/** Body for `PATCH /api/cart/[id]`. */
export const updateCartItemSchema = z.object({
  quantity,
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type SyncCartInput = z.infer<typeof syncCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
