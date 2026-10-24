import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** A server-established identity, never a value accepted in the request body. */
export type CheckoutCustomer = string | { guestKey: string };

export function checkoutPrincipal(customer: CheckoutCustomer): string {
  return typeof customer === "string" ? customer : customer.guestKey;
}

export function hashGuestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function guestOrderToken(guestKey: string, orderId: string): string {
  return createHmac("sha256", guestKey)
    .update(`guest-order:${orderId}`)
    .digest("hex");
}

export function equalTokenHash(actual: string, expected: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(actual) || !/^[a-f0-9]{64}$/.test(expected)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export function checkoutCustomerOwnsOrder(
  customer: CheckoutCustomer,
  order: { id: string; userId: string | null; guestAccessTokenHash?: string | null },
): boolean {
  if (typeof customer === "string") return order.userId === customer;
  return order.userId === null && Boolean(order.guestAccessTokenHash) &&
    equalTokenHash(
      hashGuestToken(guestOrderToken(customer.guestKey, order.id)),
      order.guestAccessTokenHash!,
    );
}

export function checkoutRequestKey(customer: CheckoutCustomer, key: string): string {
  return hashGuestToken(JSON.stringify(["checkout", checkoutPrincipal(customer), key]));
}

export function publicOrderFields<T extends object>(order: T): Omit<T, "guestAccessTokenHash" | "checkoutKey" | "checkoutFingerprint"> {
  return Object.fromEntries(Object.entries(order).filter(([key]) =>
    !["guestAccessTokenHash", "checkoutKey", "checkoutFingerprint"].includes(key),
  )) as Omit<T, "guestAccessTokenHash" | "checkoutKey" | "checkoutFingerprint">;
}

/** Initial public checkout responses must not reveal internal purchase costs. */
export function publicCheckoutOrder<T extends { items: object[] }>(order: T) {
  return {
    ...publicOrderFields(order),
    items: order.items.map((item) => Object.fromEntries(
      Object.entries(item).filter(([key]) => key !== "buyingPrice"),
    )),
  };
}
