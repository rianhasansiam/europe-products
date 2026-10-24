import type { OrderDetail } from "@/features/orders/api";
import { hasPurchaseIntent, trackPurchase } from "@/lib/analytics/meta-pixel";

/**
 * One browser tracking point for owner/cookie-scoped receipt and payment reads.
 * Guest authorization belongs to the order API, never a browser identity flag.
 */
export function trackPendingOrderPurchase(
  order: Pick<OrderDetail, "id" | "userId" | "metaPurchase">,
  ownerId: string | undefined,
): void {
  try {
    if (
      !order.id ||
      (order.userId !== null && (!ownerId || order.userId !== ownerId)) ||
      !order.metaPurchase ||
      order.metaPurchase.eventId !== `purchase:${order.id}` ||
      !hasPurchaseIntent(order.id)
    ) return;
    trackPurchase(order.metaPurchase, order.metaPurchase.eventId);
  } catch {
    // Receipt rendering and payment confirmation must never depend on analytics.
  }
}
