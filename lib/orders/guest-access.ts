import "server-only";

import { randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api/guards";
import type { AppSession } from "@/lib/auth/session";
import {
  equalTokenHash,
  guestOrderToken,
  hashGuestToken,
  type CheckoutCustomer,
} from "@/lib/orders/checkout-customer";

export { checkoutPrincipal, checkoutCustomerOwnsOrder, type CheckoutCustomer } from "@/lib/orders/checkout-customer";

export const GUEST_CHECKOUT_COOKIE = "bangbuy-guest-checkout";
export const GUEST_ACCESS_MAX_AGE = 30 * 24 * 60 * 60;

export function guestOrderCookieName(orderId: string): string {
  return `bangbuy-guest-order-${orderId}`;
}

function readCookie(request: NextRequest, name: string): string | null {
  const value = request.cookies?.get(name)?.value;
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

export async function getCheckoutCustomer(request: NextRequest) {
  const guard = await requireUser();
  if (guard.ok) {
    return { customer: guard.session.user.id as CheckoutCustomer, userId: guard.session.user.id, guestToken: null, isNewGuest: false };
  }
  const existingToken = readCookie(request, GUEST_CHECKOUT_COOKIE);
  const guestToken = existingToken ?? randomBytes(32).toString("hex");
  return {
    customer: { guestKey: `guest:${hashGuestToken(guestToken)}` } as CheckoutCustomer,
    userId: null,
    guestToken,
    isNewGuest: existingToken === null,
  };
}

/** Origin checking also works when AUTH_URL is not configured in development. */
export function isCheckoutOriginAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(process.env.AUTH_URL || request.url).origin;
  } catch {
    return false;
  }
}

export function getGuestOrderTokenHash(request: NextRequest, orderId: string): string | null {
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(orderId)) return null;
  const token = readCookie(request, guestOrderCookieName(orderId));
  return token ? hashGuestToken(token) : null;
}

export function canAccessOrder(
  order: { id: string; userId: string | null; guestAccessTokenHash?: string | null },
  session: AppSession | null,
  request: NextRequest,
): boolean {
  if (session && order.userId === session.user.id) return true;
  if (order.userId !== null || !order.guestAccessTokenHash) return false;
  const actual = getGuestOrderTokenHash(request, order.id);
  return actual !== null && equalTokenHash(actual, order.guestAccessTokenHash);
}

export function setGuestCheckoutCookies(
  response: NextResponse,
  identity: { customer: CheckoutCustomer; guestToken: string | null },
  orderId?: string,
) {
  if (!identity.guestToken || typeof identity.customer === "string") return response;
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: GUEST_ACCESS_MAX_AGE,
  };
  response.cookies.set(GUEST_CHECKOUT_COOKIE, identity.guestToken, options);
  if (orderId) {
    response.cookies.set(guestOrderCookieName(orderId), guestOrderToken(identity.customer.guestKey, orderId), options);
  }
  return response;
}
