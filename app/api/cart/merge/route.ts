import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guards";
import { hasUserOrAdminAccess } from "@/lib/auth/access";
import { jsonError, ok } from "@/lib/api/response";
import { mergeCartItems } from "@/lib/services/cart.service";
import { handleServiceError } from "@/lib/services/service-error";
import { syncCartSchema } from "@/lib/validations/cart.validation";

/**
 * POST /api/cart/merge
 *
 * Merge guest cart items into the authenticated user's server cart.
 *
 * Unlike `PUT /api/cart` (sync) which only creates items that don't
 * already exist, this endpoint **adds** guest quantities to existing
 * server rows (capped at stock). This is used at login time to combine
 * guest cart data with the user's persisted cart.
 *
 * Body: `{ items: [{ productId, variantId?, quantity }] }`
 * Returns the full cart snapshot after merging.
 */
export async function POST(request: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  if (!hasUserOrAdminAccess(guard.session.user.role)) {
    return jsonError(403, "Cart API is only available for USER/ADMIN.");
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

  const parsed = syncCartSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please review the highlighted fields and try again.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const result = await mergeCartItems(guard.session.user.id, parsed.data);
    return ok(result);
  } catch (error) {
    return handleServiceError("cart.merge", error);
  }
}
