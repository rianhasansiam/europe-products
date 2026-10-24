import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { created, jsonError, tooManyRequests } from "@/lib/api/response";
import { getClientIp, rateLimitPersistent } from "@/lib/auth/rate-limit";
import { checkoutPrincipal, publicCheckoutOrder } from "@/lib/orders/checkout-customer";
import { getCheckoutCustomer, isCheckoutOriginAllowed, setGuestCheckoutCookies } from "@/lib/orders/guest-access";
import { invalidateProductsById } from "@/lib/cache/catalog-invalidation";
import { revalidateCacheTags } from "@/lib/cache/revalidation";
import {
  CheckoutError,
  reserveOrderForAirwallex,
} from "@/lib/services/checkout.service";
import { handleServiceError, ServiceError } from "@/lib/services/service-error";
import { checkoutSchema } from "@/lib/validations/checkout.validation";
import { airwallexConfig } from "@/lib/airwallex/config/airwallex.config";
import { deriveAirwallexRequestId } from "@/lib/airwallex/security/airwallex-idempotency";
import { getCurrencyContextFromRequest } from "@/lib/currency/request-currency";

/**
 * POST /api/checkout
 *
 * Guests and authenticated customers. Totals are recomputed from the DB so
 * nothing in the body can shift the price. Customers can omit `items`
 * to have their persisted cart used, or pass `items` directly for the
 * Buy Now or selected-cart flow. The order is always attached to the session
 * userId or a new non-login guest profile. Guest order access uses a scoped
 * HttpOnly browser cookie.
 */
export async function POST(request: NextRequest) {
  if (!isCheckoutOriginAllowed(request)) return jsonError(403, "Request origin is not allowed.");
  const identity = await getCheckoutCustomer(request);

  try {
    const limit = await rateLimitPersistent(
      `checkout-submit:${checkoutPrincipal(identity.customer)}`,
      6,
      5 * 60_000,
    );
    if (!limit.allowed) return tooManyRequests(limit.resetMs);
    if (!identity.userId) {
      const ipLimit = await rateLimitPersistent(`checkout-submit-ip:${getClientIp(request)}`, 12, 5 * 60_000);
      if (!ipLimit.allowed) return tooManyRequests(ipLimit.resetMs);
    }
  } catch (error) {
    return handleServiceError("checkout.POST.rateLimit", error);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonError(415, "Content-Type must be application/json.");
  }

  let body: unknown;
  try {
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > 64 * 1024) return jsonError(413, "Checkout request is too large.");
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return jsonError(400, "Invalid JSON payload.");
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please review the highlighted fields and try again.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }
  if (identity.isNewGuest) {
    return setGuestCheckoutCookies(jsonError(409, "Refresh checkout before placing your order so your order can be safely retried."), identity);
  }

  let committedOrderId: string | undefined;
  try {
    const customer = identity.customer;
    const currencyContext = await getCurrencyContextFromRequest(request);
      if (!airwallexConfig.enabled) {
        throw new CheckoutError(
          503,
          "Airwallex payments are temporarily unavailable. Please try again later.",
        );
      }
      if (!parsed.data.idempotencyKey) {
        throw new CheckoutError(400, "A payment request ID is required.");
      }
      const reserved = await reserveOrderForAirwallex(
        customer,
        parsed.data,
        {
          id: randomUUID(),
          provider: "AIRWALLEX",
          idempotencyKey: deriveAirwallexRequestId(
            checkoutPrincipal(customer),
            parsed.data.idempotencyKey,
          ),
        },
        currencyContext,
      );
      const result = {
        order: reserved.order,
        summary: reserved.summary,
        promo: reserved.promo,
      };

    committedOrderId = result.order.id;
    // Order placement decrements stock and empties the cart. Bust the
    // cached surfaces that embed product/stock data. (The cart itself is
    // uncached and refetched fresh by the client.)
    await invalidateProductsById(
      result.order.items.flatMap((item) =>
        item.productId ? [item.productId] : [],
      ),
      { reason: `checkout stock decrement: ${result.order.id}` },
    );
    revalidateCacheTags(["admin-orders", "promo-codes"]);
    return setGuestCheckoutCookies(created({ ...result, order: publicCheckoutOrder(result.order) }), identity, result.order.id);
  } catch (error) {
    const orderId = error instanceof ServiceError
      ? typeof error.details?.orderId === "string" ? error.details.orderId : committedOrderId
      : committedOrderId;
    return setGuestCheckoutCookies(handleServiceError("checkout.POST", error), identity, orderId);
  }
}
