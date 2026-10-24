import { z } from "zod";

const productId = z.string().trim().min(1, "Product is required.");

/** Body for `POST /api/wishlist`. */
export const addWishlistItemSchema = z.object({
  productId,
});

/** Body for `PUT /api/wishlist` (sync local -> server on login). */
export const syncWishlistSchema = z.object({
  productIds: z
    .array(productId)
    .max(500, "Too many product ids in one request.")
    .default([]),
});

export type AddWishlistItemInput = z.infer<typeof addWishlistItemSchema>;
export type SyncWishlistInput = z.infer<typeof syncWishlistSchema>;
