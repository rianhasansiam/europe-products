import { adminJsonRoute } from "@/lib/api/handlers";
import { invalidateProductsById } from "@/lib/cache/catalog-invalidation";
import { updateOrderStatus } from "@/lib/services/order.service";
import { updateOrderStatusSchema } from "@/lib/validations/order.validation";

type Params = { id: string };

/**
 * PATCH /api/admin/orders/[id]/status
 *
 * Admin only. Validates the new status, enforces the allowed
 * transition graph, and — when moving to CANCELLED — restores stock
 * inside the same transaction.
 */
export const PATCH = adminJsonRoute<
  typeof updateOrderStatusSchema,
  unknown,
  Params
>({
  schema: updateOrderStatusSchema,
  scope: "admin.orders/[id].status.PATCH",
  revalidate: ["admin-orders", "promo-codes"],
  handler: async ({ body, params, session }) => {
    const order = await updateOrderStatus(params.id, body, session.user.id);
    if (body.status === "CANCELLED" || body.status === "RETURNED") {
      await invalidateProductsById(
        order.items.flatMap((item) =>
          item.productId ? [item.productId] : [],
        ),
        { reason: `admin ${body.status.toLowerCase()} stock restore: ${order.id}` },
      );
    }
    return { data: order };
  },
});
