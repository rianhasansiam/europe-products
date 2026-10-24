import "server-only";

import type { OrderStatus, Prisma } from "@/app/generated/prisma/client";

/**
 * Shared, transaction-scoped order mutation primitives.
 *
 * Customer/admin cancellation and provider-driven payment terminalization
 * must use the same row lock and inventory restoration code. Keeping these
 * helpers here prevents payment callbacks from growing a second, subtly
 * different stock/promotion implementation.
 */

/** Serialize status/payment mutations for one order. */
export async function lockOrderForStatusChange(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
}

/** Lock one persisted payment attempt after its parent order is locked. */
export async function lockPaymentAttempt(
  tx: Prisma.TransactionClient,
  paymentId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "PaymentTransaction" WHERE "id" = ${paymentId} FOR UPDATE`;
}

/** Append status history inside the transaction that updates Order.status. */
export function recordStatusHistory(
  tx: Prisma.TransactionClient,
  orderId: string,
  status: OrderStatus,
  options: { note?: string | null; updatedBy?: string | null } = {},
) {
  return tx.orderStatusHistory.create({
    data: {
      orderId,
      status,
      note: options.note ?? null,
      updatedBy: options.updatedBy ?? null,
    },
  });
}

type RestorableOrderItem = {
  variantId: string | null;
  sku: string | null;
  quantity: number;
};

/**
 * Restore a previously reserved order exactly once while the caller holds
 * the order row lock. Order state is the idempotency guard: callers invoke
 * this only while transitioning a live order to a terminal state.
 */
export async function restoreStockForItems(
  tx: Prisma.TransactionClient,
  items: RestorableOrderItem[],
  orderNumber: string,
) {
  for (const item of items) {
    let variantId = item.variantId ?? null;

    if (!variantId && item.sku) {
      const variant = await tx.productVariant.findUnique({
        where: { sku: item.sku },
        select: { id: true },
      });
      variantId = variant?.id ?? null;
    }

    if (!variantId) continue;

    const exists = await tx.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true },
    });
    if (!exists) continue;

    await tx.productVariant.update({
      where: { id: variantId },
      data: { stock: { increment: item.quantity } },
    });
    await tx.inventoryLog.create({
      data: {
        variantId,
        type: "ORDER_CANCELLED",
        quantity: item.quantity,
        note: `Order ${orderNumber} cancelled`,
      },
    });
  }
}

/**
 * Release promotion reservations attached to an order.
 *
 * The conditional delete is the idempotency guard. `usedCount` is decremented
 * only when this transaction actually removed a usage row.
 */
export async function releasePromotionUsage(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<boolean> {
  const usages = await tx.promoCodeUsage.findMany({
    where: { orderId },
    select: { id: true, promoCodeId: true },
  });

  let released = false;
  for (const usage of usages) {
    const deleted = await tx.promoCodeUsage.deleteMany({
      where: { id: usage.id },
    });
    if (deleted.count !== 1) continue;

    released = true;
    await tx.promoCode.updateMany({
      where: { id: usage.promoCodeId, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  }

  return released;
}
