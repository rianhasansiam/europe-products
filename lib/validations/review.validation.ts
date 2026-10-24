import { z } from "zod";

/**
 * Zod schemas for the Review API.
 *
 * Mirrors the Prisma `Review` model. The customer-create path never
 * trusts a client-sent author name or verified flag — those are derived
 * server-side from the session and the user's delivered orders. Admins
 * get a separate create schema that captures a display name and an
 * optional userId-less attribution.
 */

const REVIEW_SOURCE = ["CUSTOMER", "ADMIN"] as const;

const rating = z
  .number({ error: "Rating is required." })
  .int("Rating must be a whole number.")
  .min(1, "Rating must be at least 1 star.")
  .max(5, "Rating cannot exceed 5 stars.");

const title = z
  .string()
  .trim()
  .max(120, "Title is too long.")
  .optional();

const comment = z
  .string()
  .trim()
  .max(2000, "Review is too long.")
  .optional();

/** Body for `POST /api/reviews` — a logged-in customer reviewing a product. */
export const createReviewSchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  rating,
  title,
  comment,
});

/** Body for `POST /api/admin/reviews` — admin seeds a review for a product. */
export const createAdminReviewSchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  authorName: z
    .string()
    .trim()
    .min(2, "Author name is too short.")
    .max(120, "Author name is too long."),
  rating,
  title,
  comment,
});

/** Query string for `GET /api/reviews?productId=...` (public). */
export const reviewQuerySchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** Query string for `GET /api/admin/reviews` (admin moderation list). */
export const adminReviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  source: z.enum(REVIEW_SOURCE).optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type CreateAdminReviewInput = z.infer<typeof createAdminReviewSchema>;
export type ReviewQueryInput = z.infer<typeof reviewQuerySchema>;
export type AdminReviewQueryInput = z.infer<typeof adminReviewQuerySchema>;
