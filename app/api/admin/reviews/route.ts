import type { z } from "zod";

import { adminJsonRoute, adminRoute } from "@/lib/api/handlers";
import { invalidateProductsById } from "@/lib/cache/catalog-invalidation";
import {
  createAdminReview,
  listReviewsForAdmin,
} from "@/lib/services/review.service";
import {
  adminReviewQuerySchema,
  createAdminReviewSchema,
} from "@/lib/validations/review.validation";

type AdminReviewQuery = z.infer<typeof adminReviewQuerySchema>;

/**
 * GET /api/admin/reviews
 *
 * Admin only. Pagination, search across author/title/comment/product,
 * filter by rating and source, newest first.
 */
export const GET = adminRoute({
  scope: "admin.reviews.GET",
  querySchema: adminReviewQuerySchema,
  handler: async ({ query }) => {
    const { items, meta } = await listReviewsForAdmin(query as AdminReviewQuery);
    return { data: items, meta };
  },
});

/**
 * POST /api/admin/reviews
 *
 * Admin only. Seed a review for a specific product (not tied to a user).
 */
export const POST = adminJsonRoute({
  schema: createAdminReviewSchema,
  scope: "admin.reviews.POST",
  handler: async ({ body }) => {
    const review = await createAdminReview(body);
    await invalidateProductsById([review.productId], {
      reason: `admin review created: ${review.id}`,
      reviews: true,
    });
    return { status: 201, data: review };
  },
});
