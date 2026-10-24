import type { NextRequest } from "next/server";

import { requireUser } from "@/lib/api/guards";
import { ok } from "@/lib/api/response";
import { invalidateProductsById } from "@/lib/cache/catalog-invalidation";
import { revalidateCacheTags } from "@/lib/cache/revalidation";
import { cancelOrderAsCustomer } from "@/lib/services/order.service";
import { handleServiceError } from "@/lib/services/service-error";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/orders/[id]/cancel
 *
 * Logged-in users only. The service refuses to cancel orders that
 * aren't owned by the caller (404) or aren't in PENDING/PROCESSING
 * (409). Stock is restored in the same transaction.
 *
 * Body is intentionally optional — cancellation needs no extra input.
 */
export async function PATCH(_request: NextRequest, context: RouteContext) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;

  try {
    const order = await cancelOrderAsCustomer(id, guard.session.user.id);
    // Cancellation restores stock — refresh cached product surfaces.
    await invalidateProductsById(
      order.items.flatMap((item) => (item.productId ? [item.productId] : [])),
      { reason: `customer cancellation stock restore: ${order.id}` },
    );
    revalidateCacheTags(["admin-orders", "promo-codes"]);
    return ok(order);
  } catch (error) {
    return handleServiceError("orders/[id].cancel.PATCH", error);
  }
}
