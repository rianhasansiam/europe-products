import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guards";
import { hasUserOrAdminAccess } from "@/lib/auth/access";
import { created, jsonError, ok } from "@/lib/api/response";
import { handleServiceError } from "@/lib/services/service-error";
import {
  addWishlistItem,
  clearMyWishlist,
  getMyWishlist,
  syncWishlistProducts,
} from "@/lib/services/wishlist.service";
import {
  addWishlistItemSchema,
  syncWishlistSchema,
} from "@/lib/validations/wishlist.validation";

/**
 * GET /api/wishlist
 *
 * Logged-in USER/ADMIN only. Returns the caller's wishlist.
 */
export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  if (!hasUserOrAdminAccess(guard.session.user.role)) {
    return jsonError(403, "Wishlist API is only available for USER/ADMIN.");
  }

  try {
    const items = await getMyWishlist(guard.session.user.id);
    return ok(items);
  } catch (error) {
    return handleServiceError("wishlist.GET", error);
  }
}

/**
 * POST /api/wishlist
 *
 * Logged-in USER/ADMIN only. Add one product to wishlist.
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

  const parsed = addWishlistItemSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please review the highlighted fields and try again.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const item = await addWishlistItem(guard.session.user.id, parsed.data);
    return created(item);
  } catch (error) {
    return handleServiceError("wishlist.POST", error);
  }
}

/**
 * PUT /api/wishlist
 *
 * Logged-in USER/ADMIN only. Sync local product ids into DB wishlist.
 */
export async function PUT(request: NextRequest) {
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
    return handleServiceError("wishlist.PUT", error);
  }
}

/**
 * DELETE /api/wishlist
 *
 * Logged-in USER/ADMIN only. Clear current user's wishlist.
 */
export async function DELETE() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  if (!hasUserOrAdminAccess(guard.session.user.role)) {
    return jsonError(403, "Wishlist API is only available for USER/ADMIN.");
  }

  try {
    const result = await clearMyWishlist(guard.session.user.id);
    return ok(result);
  } catch (error) {
    return handleServiceError("wishlist.DELETE", error);
  }
}
