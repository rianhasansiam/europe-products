import { requireUser } from "@/lib/api/guards";
import { hasUserOrAdminAccess } from "@/lib/auth/access";
import { jsonError, ok } from "@/lib/api/response";
import { clearMyCart } from "@/lib/services/cart.service";
import { handleServiceError } from "@/lib/services/service-error";

/**
 * DELETE /api/cart/clear
 *
 * Logged-in users only. Empties the caller's cart. Idempotent — a
 * second call simply returns `{ deletedCount: 0 }`.
 */
export async function DELETE() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  if (!hasUserOrAdminAccess(guard.session.user.role)) {
    return jsonError(403, "Cart API is only available for USER/ADMIN.");
  }

  try {
    const result = await clearMyCart(guard.session.user.id);
    return ok(result);
  } catch (error) {
    return handleServiceError("cart.clear.DELETE", error);
  }
}
