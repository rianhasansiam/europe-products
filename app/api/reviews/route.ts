import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guards";
import { hasUserOrAdminAccess } from "@/lib/auth/access";
import { created, jsonError, ok } from "@/lib/api/response";
import { invalidateProductsById } from "@/lib/cache/catalog-invalidation";
import {
  createCustomerReview,
  listProductReviews,
} from "@/lib/services/review.service";
import { handleServiceError } from "@/lib/services/service-error";
import {
  createReviewSchema,
  reviewQuerySchema,
} from "@/lib/validations/review.validation";

/**
 * GET /api/reviews?productId=...
 *
 * Public. Returns a product's reviews (paginated, newest first) along
 * with the aggregate summary (average + star distribution) in `meta`.
 */
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = reviewQuerySchema.safeParse(params);
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const { items, summary, meta } = await listProductReviews(parsed.data);
    return ok(items, { ...meta, summary });
  } catch (error) {
    return handleServiceError("reviews.GET", error);
  }
}

/**
 * POST /api/reviews
 *
 * Logged-in USER/ADMIN only. Create a review for a product the caller
 * has received (a DELIVERED order). The service enforces eligibility and
 * the one-review-per-product rule.
 */
export async function POST(request: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  if (!hasUserOrAdminAccess(guard.session.user.role)) {
    return jsonError(403, "Reviews API is only available for USER/ADMIN.");
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonError(415, "Content-Type must be application/json.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON payload.");
  }

  const parsed = createReviewSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please review the highlighted fields and try again.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const review = await createCustomerReview(
      guard.session.user.id,
      parsed.data,
    );
    await invalidateProductsById([review.productId], {
      reason: `customer review created: ${review.id}`,
      reviews: true,
    });
    return created(review);
  } catch (error) {
    return handleServiceError("reviews.POST", error);
  }
}
