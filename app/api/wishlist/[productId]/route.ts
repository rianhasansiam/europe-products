import { requireUser } from "@/lib/api/guards";
import { hasUserOrAdminAccess } from "@/lib/auth/access";
import { jsonError, ok } from "@/lib/api/response";
import { handleServiceError } from "@/lib/services/service-error";
import { removeWishlistItemByProduct } from "@/lib/services/wishlist.service";

type RouteContext = { params: Promise<{ productId: string }> };

/**
 * DELETE /api/wishlist/[productId]
 *
 * Logged-in USER/ADMIN only. Removes a product from caller's wishlist.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  if (!hasUserOrAdminAccess(guard.session.user.role)) {
    return jsonError(403, "Wishlist API is only available for USER/ADMIN.");
  }

  const { productId } = await context.params;

  try {
    const result = await removeWishlistItemByProduct(guard.session.user.id, productId);
    return ok(result);
  } catch (error) {
    return handleServiceError("wishlist/[productId].DELETE", error);
  }
}
