import { adminJsonRoute } from "@/lib/api/handlers";
import { invalidateProductsById } from "@/lib/cache/catalog-invalidation";
import {
  approveSslCommerzPaymentReview,
  recordSslCommerzRefundAndCancel,
} from "@/lib/services/order.service";
import { resolvePaymentReviewSchema } from "@/lib/validations/order.validation";

type Params = { id: string };

/**
 * PATCH /api/admin/orders/[id]/payment-review
 *
 * Historical records only; no gateway connection or new collection.
 * Admin-only, DB-role-refreshed resolution of an SSLCommerz risk/operations
 * hold. Generic status and payment-status routes intentionally cannot bypass
 * this action.
 */
export const PATCH = adminJsonRoute<
  typeof resolvePaymentReviewSchema,
  unknown,
  Params
>({
  schema: resolvePaymentReviewSchema,
  scope: "admin.orders/[id].payment-review.PATCH",
  revalidate: ["admin-orders", "promo-codes"],
  handler: async ({ body, params, session }) => {
    if (body.decision === "APPROVE") {
      const order = await approveSslCommerzPaymentReview(
        params.id,
        session.user.id,
      );
      return { data: order };
    }

    const result = await recordSslCommerzRefundAndCancel(
      params.id,
      body.refundReference,
      session.user.id,
    );
    await invalidateProductsById(result.affectedProductIds, {
      reason: `admin SSLCommerz refund cancellation stock restore: ${params.id}`,
    });
    return { data: result.order };
  },
});
