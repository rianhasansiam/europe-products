import "server-only";

import { jsonError, ok } from "@/lib/api/response";

import { handleAirwallexApiError } from "../errors/airwallex.errors";
import { ingestVerifiedAirwallexWebhook } from "../services/airwallex-payment-event.service";

const MAX_WEBHOOK_BYTES = 256 * 1024;

export async function POST(request: Request): Promise<Response> {
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > MAX_WEBHOOK_BYTES
  ) {
    return jsonError(413, "Payment notification is too large.");
  }

  let rawBody: string;
  try {
    // Airwallex signs timestamp + this exact untouched string.
    rawBody = await request.text();
  } catch {
    return jsonError(400, "Invalid payment notification.");
  }
  if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BYTES) {
    return jsonError(413, "Payment notification is too large.");
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return jsonError(415, "Payment notification must use JSON.");
  }

  try {
    const result = await ingestVerifiedAirwallexWebhook({
      rawBody,
      timestamp: request.headers.get("x-timestamp"),
      signature: request.headers.get("x-signature"),
    });
    // No provider lookup or business transition happens before this 200.
    return ok({ received: true, duplicate: result.duplicate });
  } catch (error) {
    return handleAirwallexApiError("airwallex.webhook.POST", error);
  }
}
