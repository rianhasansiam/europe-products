import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guards";
import { hasUserOrAdminAccess } from "@/lib/auth/access";
import { jsonError, ok } from "@/lib/api/response";
import {
  removeCartItem,
  updateCartItem,
} from "@/lib/services/cart.service";
import { handleServiceError } from "@/lib/services/service-error";
import { updateCartItemSchema } from "@/lib/validations/cart.validation";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/cart/[id]
 *
 * Logged-in users only. Updates the quantity of a cart row the caller
 * owns. Ownership is enforced inside the service via a SQL `where`
 * scope, so an unauthorized request returns 404 (no IDOR existence leak).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  if (!hasUserOrAdminAccess(guard.session.user.role)) {
    return jsonError(403, "Cart API is only available for USER/ADMIN.");
  }

  const { id } = await context.params;

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

  const parsed = updateCartItemSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please review the highlighted fields and try again.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const item = await updateCartItem(id, guard.session.user.id, parsed.data);
    return ok(item);
  } catch (error) {
    return handleServiceError("cart/[id].PATCH", error);
  }
}

/**
 * DELETE /api/cart/[id]
 *
 * Logged-in users only. Removes a cart row owned by the caller.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  if (!hasUserOrAdminAccess(guard.session.user.role)) {
    return jsonError(403, "Cart API is only available for USER/ADMIN.");
  }

  const { id } = await context.params;

  try {
    const result = await removeCartItem(id, guard.session.user.id);
    return ok(result);
  } catch (error) {
    return handleServiceError("cart/[id].DELETE", error);
  }
}
