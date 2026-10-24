import { adminRoute } from "@/lib/api/handlers";
import { jsonError } from "@/lib/api/response";
import { getOrderForAdmin } from "@/lib/services/order.service";

type Params = { id: string };

/**
 * GET /api/admin/orders/[id]
 *
 * Admin only. Returns the full order with items, products, and the
 * customer's basic info.
 */
export const GET = adminRoute<unknown, Params>({
  scope: "admin.orders/[id].GET",
  handler: async ({ params }) => {
    const order = await getOrderForAdmin(params.id);
    if (!order) return { raw: jsonError(404, "Order not found.") };
    return { data: order };
  },
});
