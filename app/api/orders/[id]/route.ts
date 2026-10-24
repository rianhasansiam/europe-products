import type { NextRequest } from "next/server";

import { isAdminRequest, requireUser } from "@/lib/api/guards";
import { jsonError, ok } from "@/lib/api/response";
import { getGuestOrderTokenHash } from "@/lib/orders/guest-access";
import {
  getCustomerOrderViewForAdmin,
  getOrderForUser,
  getOrderForGuest,
} from "@/lib/services/order.service";
import { handleServiceError } from "@/lib/services/service-error";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/orders/[id]
 *
 * Customers can read only their own order; guests need an order-specific
 * bearer cookie. Admins can read any. The customer query is scoped in
 * SQL so unauthorized requests return 404 (no IDOR existence leak).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const guard = await requireUser();
  const { id } = await context.params;
  const tokenHash = getGuestOrderTokenHash(request, id);
  if (!guard.ok && !tokenHash) return guard.response;

  try {
    let order = guard.ok
      ? (await isAdminRequest())
        ? await getCustomerOrderViewForAdmin(id)
        : await getOrderForUser(id, guard.session.user.id)
      : null;
    if (!order && tokenHash) order = await getOrderForGuest(id, tokenHash);

    if (!order) return jsonError(404, "Order not found.");
    return ok(order);
  } catch (error) {
    return handleServiceError("orders/[id].GET", error);
  }
}
