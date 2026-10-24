import { adminRoute } from "@/lib/api/handlers";
import { invalidateProductsById } from "@/lib/cache/catalog-invalidation";
import { deleteReview } from "@/lib/services/review.service";

type Params = { id: string };

/**
 * DELETE /api/admin/reviews/[id]
 *
 * Admin only. Hard-delete a review.
 */
export const DELETE = adminRoute<unknown, Params>({
  scope: "admin.reviews/[id].DELETE",
  handler: async ({ params }) => {
    const result = await deleteReview(params.id);
    await invalidateProductsById([result.productId], {
      reason: `review deleted: ${result.id}`,
      reviews: true,
    });
    return { data: result };
  },
});
