import "server-only";

import { NextRequest } from "next/server";

import type { AuthGuard } from "@/lib/api/guards";
import { prisma } from "@/lib/db/prisma";
import { canAccessOrder } from "@/lib/orders/guest-access";
import type { PaymentOrderCustomer } from "./payment-order-customer";

export function hasGuestPaymentCookie(request: Request): boolean {
  const cookies = new NextRequest(request.url, { headers: request.headers }).cookies;
  return cookies.getAll().some((cookie) => cookie.name.startsWith("bangbuy-guest-order-"));
}

export async function getPaymentCustomerForOrder(
  request: Request,
  orderId: string,
  guard: AuthGuard,
): Promise<PaymentOrderCustomer | null> {
  const nextRequest = new NextRequest(request.url, { headers: request.headers });
  if (!nextRequest.cookies.has(`bangbuy-guest-order-${orderId}`)) {
    return guard.ok ? guard.session.user.id : null;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, guestAccessTokenHash: true },
  });
  if (!order || !canAccessOrder(order, guard.ok ? guard.session : null, nextRequest)) {
    return null;
  }
  if (order.userId !== null) return order.userId;
  return order.guestAccessTokenHash
    ? { guestAccessTokenHash: order.guestAccessTokenHash }
    : null;
}
