import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";

/** Guest identities here have already proved possession of an order cookie. */
export type PaymentOrderCustomer =
  | string
  | { guestAccessTokenHash: string };

export function paymentCustomerOrderWhere(
  customer: PaymentOrderCustomer,
): Prisma.OrderWhereInput {
  return typeof customer === "string"
    ? { userId: customer }
    : { userId: null, guestAccessTokenHash: customer.guestAccessTokenHash };
}

export function paymentCustomerPrincipal(customer: PaymentOrderCustomer): string {
  return typeof customer === "string"
    ? customer
    : `guest:${customer.guestAccessTokenHash}`;
}
