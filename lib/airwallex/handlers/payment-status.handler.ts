import "server-only";

import { requireUser } from "@/lib/api/guards";
import { jsonError, ok, tooManyRequests } from "@/lib/api/response";
import { getClientIp, rateLimitPersistent } from "@/lib/auth/rate-limit";
import {
  getPaymentCustomerForOrder,
  hasGuestPaymentCookie,
} from "@/lib/payments/core/payment-order-access";
import { paymentCustomerPrincipal } from "@/lib/payments/core/payment-order-customer";

import { handleAirwallexApiError } from "../errors/airwallex.errors";
import { airwallexInitiatePaymentRequestSchema } from "../schemas/airwallex.schemas";
import { getOwnerScopedAirwallexPaymentStatus } from "../services/airwallex-payment-status.service";

type PaymentStatusRouteContext = {
  params: Promise<{ orderId: string }>;
};

const STATUS_RATE_LIMIT = 90;
const STATUS_RATE_WINDOW_MS = 60_000;

export async function GET(
  request: Request,
  context: PaymentStatusRouteContext,
): Promise<Response> {
  const guard = await requireUser();
  if (!guard.ok && !hasGuestPaymentCookie(request)) return guard.response;

  const params = await context.params;
  const parsed = airwallexInitiatePaymentRequestSchema.safeParse(params);
  if (!parsed.success) return jsonError(400, "Invalid order identifier.");

  try {
    const ipLimit = await rateLimitPersistent(
      `airwallex-status-ip:${getClientIp(request)}`,
      STATUS_RATE_LIMIT * 2,
      STATUS_RATE_WINDOW_MS,
    );
    if (!ipLimit.allowed) return tooManyRequests(ipLimit.resetMs);
    const customer = await getPaymentCustomerForOrder(request, parsed.data.orderId, guard);
    if (!customer) return jsonError(404, "Order not found.");
    const limit = await rateLimitPersistent(
      `airwallex-status:${paymentCustomerPrincipal(customer)}:${parsed.data.orderId}`,
      STATUS_RATE_LIMIT,
      STATUS_RATE_WINDOW_MS,
    );
    if (!limit.allowed) return tooManyRequests(limit.resetMs);

    const status = await getOwnerScopedAirwallexPaymentStatus(
      customer,
      parsed.data.orderId,
    );
    if (!status) return jsonError(404, "Order not found.");
    return ok(status);
  } catch (error) {
    return handleAirwallexApiError("airwallex.status.GET", error);
  }
}
