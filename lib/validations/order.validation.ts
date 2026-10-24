import { z } from "zod";

import { ORDER_STATUSES } from "@/lib/orders/status";

/**
 * Zod schemas for the Order API.
 *
 * Notes:
 *  - The client never sends prices. We always recompute from the DB.
 *  - `items` is optional on create: when omitted, the order is built
 *    from the user's current cart. When provided, it overrides the
 *    cart (e.g. "Buy now" flow).
 *  - Order statuses come from `@/lib/orders/status`, the single source
 *    of truth shared with the service layer and the UI.
 */

const ORDER_STATUS = ORDER_STATUSES;

const PAYMENT_STATUS_FILTER = [
  "PAID",
  "UNPAID",
  "PENDING",
  "FAILED",
  "REFUNDED",
] as const;
const MANUAL_PAYMENT_STATUS = ["PAID", "UNPAID"] as const;

/** Query string for `GET /api/orders/my-orders`. */
export const orderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(ORDER_STATUS).optional(),
});

/** Query string for `GET /api/admin/orders`. */
export const adminOrderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  status: z.enum(ORDER_STATUS).optional(),
  paymentStatus: z.enum(PAYMENT_STATUS_FILTER).optional(),
  customerType: z.enum(["GUEST", "REGISTERED"]).optional(),
});

/** Body for `PATCH /api/admin/orders/[id]/status`. */
export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUS),
  // Optional free-text note recorded alongside the status change in the
  // order's audit trail (e.g. courier name, reason for cancellation).
  note: z.string().trim().max(500).optional(),
});

/** Body for `PATCH /api/admin/orders/[id]/payment-status`. */
export const updatePaymentStatusSchema = z.object({
  paymentStatus: z.enum(MANUAL_PAYMENT_STATUS),
});

/**
 * Body for `PATCH /api/admin/orders/[id]/payment-review`.
 *
 * Approving a provider risk hold is a privileged assertion, not a generic
 * fulfillment transition, so it has a dedicated controlled action.
 */
export const resolvePaymentReviewSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("APPROVE"),
  }),
  z.object({
    decision: z.literal("REFUND_AND_CANCEL"),
    refundReference: z
      .string()
      .trim()
      .min(4, "Refund reference is required.")
      .max(200, "Refund reference is too long.")
      .regex(
        /^[A-Za-z0-9][A-Za-z0-9._:/, -]*$/,
        "Refund reference contains unsupported characters.",
      ),
  }),
]);

/** Body for `PATCH /api/orders/[id]/cancel` — empty/optional reason. */
export const cancelOrderSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type OrderQueryInput = z.infer<typeof orderQuerySchema>;
export type AdminOrderQueryInput = z.infer<typeof adminOrderQuerySchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type UpdatePaymentStatusInput = z.infer<
  typeof updatePaymentStatusSchema
>;
export type ResolvePaymentReviewInput = z.infer<
  typeof resolvePaymentReviewSchema
>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
