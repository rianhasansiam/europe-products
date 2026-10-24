import { requireUser } from "@/lib/api/guards";
import { hasUserOrAdminAccess } from "@/lib/auth/access";
import { jsonError, ok } from "@/lib/api/response";
import { listReviewableProducts } from "@/lib/services/review.service";
import { handleServiceError } from "@/lib/services/service-error";

/**
 * GET /api/reviews/reviewable
 *
 * Logged-in USER/ADMIN only. Returns the products the caller can review
 * right now: those in a DELIVERED order that they haven't reviewed yet.
 * Used by the "My Orders" tab to surface a "Write a review" CTA.
 */
export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  if (!hasUserOrAdminAccess(guard.session.user.role)) {
    return jsonError(403, "Reviews API is only available for USER/ADMIN.");
  }

  try {
    const items = await listReviewableProducts(guard.session.user.id);
    return ok(items);
  } catch (error) {
    return handleServiceError("reviews.reviewable.GET", error);
  }
}
