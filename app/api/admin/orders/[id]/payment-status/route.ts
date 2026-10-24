import { adminJsonRoute } from "@/lib/api/handlers";
import { updatePaymentStatus } from "@/lib/services/order.service";
import { updatePaymentStatusSchema } from "@/lib/validations/order.validation";

type Params = { id: string };

/**
 * PATCH /api/admin/orders/[id]/payment-status
 *
 * Admin only. Flips between PAID and UNPAID with a no-op guard so we
 * don't generate empty audit noise.
 */
export const PATCH = adminJsonRoute<
  typeof updatePaymentStatusSchema,
  unknown,
  Params
>({
  schema: updatePaymentStatusSchema,
  scope: "admin.orders/[id].payment-status.PATCH",
  revalidate: ["admin-orders"],
  handler: async ({ body, params }) => {
    const order = await updatePaymentStatus(params.id, body);
    return { data: order };
  },
});
