import type { NextRequest } from "next/server";
import { z } from "zod";

import { jsonError, ok, tooManyRequests } from "@/lib/api/response";
import { getClientIp, rateLimitPersistent } from "@/lib/auth/rate-limit";
import { checkoutPrincipal } from "@/lib/orders/checkout-customer";
import { getCheckoutCustomer, isCheckoutOriginAllowed, setGuestCheckoutCookies } from "@/lib/orders/guest-access";
import { airwallexConfig } from "@/lib/airwallex/config/airwallex.config";
import {
  AirwallexConfigurationError,
  AirwallexValidationError,
} from "@/lib/airwallex/errors/airwallex.errors";
import {
  quoteAirwallexPayment,
  toPublicAirwallexPaymentQuote,
  type PublicAirwallexPaymentQuote,
} from "@/lib/airwallex/services/airwallex-currency.service";
import { createAirwallexPaymentQuoteToken } from "@/lib/airwallex/security/airwallex-payment-quote-token";
import { getCurrencyContextFromRequest } from "@/lib/currency/request-currency";
import { previewCheckout } from "@/lib/services/checkout.service";
import { handleServiceError } from "@/lib/services/service-error";
import { checkoutPreviewSchema } from "@/lib/validations/checkout.validation";

/**
 * POST /api/checkout/preview
 *
 * Read-only for guests and authenticated customers. Guests provide
 * explicit items; authenticated customers may omit them to use their
 * persisted cart. Nothing in the DB is mutated. All money math (tax,
 * shipping, free-shipping threshold, and promos) happens server-side.
 */
export async function POST(request: NextRequest) {
  if (!isCheckoutOriginAllowed(request)) return jsonError(403, "Request origin is not allowed.");
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

  const parsed = checkoutPreviewSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please review the highlighted fields and try again.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const limit = await rateLimitPersistent(`checkout-preview:${getClientIp(request)}`, 60, 60_000);
    if (!limit.allowed) return tooManyRequests(limit.resetMs);
    const identity = await getCheckoutCustomer(request);
    const currencyContext = await getCurrencyContextFromRequest(request);
    const preview = await previewCheckout(
      identity.userId,
      parsed.data,
      currencyContext,
    );

    let airwallexPaymentQuote:
      | (PublicAirwallexPaymentQuote & { quoteToken: string })
      | null = null;
    if (airwallexConfig.enabled) {
      try {
        const quote = await quoteAirwallexPayment({
          baseAmount: preview.summary.baseTotal,
          displayContext: currencyContext,
        });
        airwallexPaymentQuote = {
          ...toPublicAirwallexPaymentQuote(quote),
          quoteToken: createAirwallexPaymentQuoteToken({
            userId: checkoutPrincipal(identity.customer),
            quote,
          }),
        };
      } catch (error) {
        if (
          !(error instanceof AirwallexConfigurationError) &&
          !(error instanceof AirwallexValidationError)
        ) {
          throw error;
        }
      }
    }

    return setGuestCheckoutCookies(ok({
      ...preview,
      airwallexPaymentQuote,
      availablePaymentMethods: [
        ...(airwallexPaymentQuote ? (["AIRWALLEX"] as const) : []),
      ],
    }), identity);
  } catch (error) {
    return handleServiceError("checkout.preview.POST", error);
  }
}
