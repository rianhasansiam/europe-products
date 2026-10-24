import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guards";
import { hasUserOrAdminAccess } from "@/lib/auth/access";
import { jsonError, ok } from "@/lib/api/response";
import { syncWishlistProducts } from "@/lib/services/wishlist.service";
import { handleServiceError } from "@/lib/services/service-error";
import { syncWishlistSchema } from "@/lib/validations/wishlist.validation";

/**
 * POST /api/wishlist/merge
 *
 * Merge guest wishlist product IDs into the authenticated user's
 * server wishlist. Uses `syncWishlistProducts` which does
 * `createMany` with `skipDuplicates: true`, so existing items are
 * not duplicated.
 *
 * Body: `{ productIds: string[] }`
 * Returns the full wishlist after merging.
 */
export async function POST(request: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  if (!hasUserOrAdminAccess(guard.session.user.role)) {
    return jsonError(403, "Wishlist API is only available for USER/ADMIN.");
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

  const parsed = syncWishlistSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please review the highlighted fields and try again.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const items = await syncWishlistProducts(guard.session.user.id, parsed.data);
    return ok(items);
  } catch (error) {
    return handleServiceError("wishlist.merge", error);
  }
}
