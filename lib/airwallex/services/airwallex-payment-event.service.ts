import "server-only";

import { requireAirwallexConfig } from "../config/airwallex.config";
import {
  AirwallexError,
  AirwallexValidationError,
} from "../errors/airwallex.errors";
import {
  claimAirwallexWebhookEvents,
  ingestAirwallexWebhookEvent,
  releaseAirwallexEventForRetry,
  type ClaimedAirwallexEvent,
  type IngestAirwallexEventInput,
} from "../repositories/airwallex-payment.repository";
import { airwallexProcessableWebhookEnvelopeSchema } from "../schemas/airwallex-webhook.schemas";
import { logAirwallexEvent } from "../security/airwallex-redaction";
import { verifyAirwallexWebhookSignature } from "../security/airwallex-webhook-signature";
import type {
  AirwallexPaymentAttemptWebhookData,
  AirwallexPaymentIntentWebhookData,
} from "../types/airwallex-webhook.types";
import { retrieveAirwallexPaymentIntent } from "./airwallex-payment-intent.service";
import {
  applyAuthoritativeAirwallexPayment,
  toAirwallexAuthoritativePayment,
} from "./airwallex-payment-verification.service";

const DEFAULT_EVENT_BATCH_SIZE = 1;
const MAX_EVENT_PROCESSING_ATTEMPTS = 5;

export type IngestAirwallexWebhookInput = {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
};

export type IngestAirwallexWebhookResult = {
  eventId: string;
  paymentIntentId: string;
  duplicate: boolean;
};

export type AirwallexEventProcessingSummary = {
  claimed: number;
  processed: number;
  requiresReview: number;
  retryScheduled: number;
  persistenceErrors: number;
};

function parseWebhookPayload(rawBody: string) {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new AirwallexValidationError("Invalid payment notification.");
  }

  const parsed = airwallexProcessableWebhookEnvelopeSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AirwallexValidationError("Invalid payment notification.");
  }
  return parsed.data;
}

function webhookPaymentIntentId(
  event: ReturnType<typeof parseWebhookPayload>,
): string {
  const object = event.data.object;
  return isPaymentAttemptObject(object) ? object.payment_intent_id : object.id;
}

function isPaymentAttemptObject(
  object:
    | AirwallexPaymentIntentWebhookData["object"]
    | AirwallexPaymentAttemptWebhookData["object"],
): object is AirwallexPaymentAttemptWebhookData["object"] {
  return "payment_intent_id" in object;
}

function persistableWebhookPayload(
  event: ReturnType<typeof parseWebhookPayload>,
): IngestAirwallexEventInput["sanitizedPayload"] {
  const object = event.data.object;
  const safeObject = isPaymentAttemptObject(object)
    ? {
        id: object.id,
        payment_intent_id: object.payment_intent_id,
        status: object.status,
        ...(object.amount !== undefined ? { amount: object.amount } : {}),
        ...(object.currency ? { currency: object.currency } : {}),
        ...(object.failure_code
          ? { failure_code: object.failure_code }
          : {}),
        ...(object.created_at ? { created_at: object.created_at } : {}),
        ...(object.updated_at ? { updated_at: object.updated_at } : {}),
      }
    : {
        id: object.id,
        request_id: object.request_id,
        amount: object.amount,
        currency: object.currency,
        merchant_order_id: object.merchant_order_id,
        status: object.status,
        created_at: object.created_at,
        updated_at: object.updated_at,
        ...(object.captured_amount !== undefined
          ? { captured_amount: object.captured_amount }
          : {}),
        ...(object.cancelled_at
          ? { cancelled_at: object.cancelled_at }
          : {}),
        ...(object.latest_payment_attempt
          ? {
              latest_payment_attempt: {
                id: object.latest_payment_attempt.id,
                status: object.latest_payment_attempt.status,
                ...(object.latest_payment_attempt.payment_intent_id
                  ? {
                      payment_intent_id:
                        object.latest_payment_attempt.payment_intent_id,
                    }
                  : {}),
                ...(object.latest_payment_attempt.failure_code
                  ? {
                      failure_code:
                        object.latest_payment_attempt.failure_code,
                    }
                  : {}),
              },
            }
          : {}),
      };

  // Rebuild rather than persist the provider envelope so metadata, failure
  // details, PII, client secrets, and future unreviewed fields never land in DB.
  return JSON.parse(
    JSON.stringify({
      id: event.id,
      name: event.name,
      ...(event.account_id ? { account_id: event.account_id } : {}),
      ...(event.org_id ? { org_id: event.org_id } : {}),
      created_at: event.created_at,
      version: event.version,
      data: { object: safeObject },
    }),
  ) as IngestAirwallexEventInput["sanitizedPayload"];
}

function processingErrorCode(error: unknown): string {
  return error instanceof AirwallexError
    ? error.code
    : "AIRWALLEX_EVENT_PROCESSING_ERROR";
}

/** Authenticate, sanitize, and durably persist a delivery without processing it. */
export async function ingestVerifiedAirwallexWebhook(
  input: IngestAirwallexWebhookInput,
): Promise<IngestAirwallexWebhookResult> {
  const config = requireAirwallexConfig();
  verifyAirwallexWebhookSignature({
    rawBody: input.rawBody,
    timestamp: input.timestamp,
    signature: input.signature,
    secret: config.webhookSecret,
    toleranceSeconds: config.webhookToleranceSeconds,
  });

  // Parsing happens only after the exact raw body has passed HMAC verification.
  const event = parseWebhookPayload(input.rawBody);
  const paymentIntentId = webhookPaymentIntentId(event);
  const result = await ingestAirwallexWebhookEvent({
    eventId: event.id,
    eventName: event.name,
    paymentIntentId,
    ...(event.account_id ? { accountId: event.account_id } : {}),
    apiVersion: event.version,
    sanitizedPayload: persistableWebhookPayload(event),
  });

  logAirwallexEvent({
    event: result.duplicate ? "WEBHOOK_DUPLICATE" : "WEBHOOK_INGESTED",
    paymentIntentId,
    providerEventId: event.id,
    eventName: event.name,
  });

  return {
    eventId: event.id,
    paymentIntentId,
    duplicate: result.duplicate,
  };
}

function validateClaimedPayload(event: ClaimedAirwallexEvent) {
  const parsed = airwallexProcessableWebhookEnvelopeSchema.safeParse(
    event.sanitizedPayload,
  );
  if (
    !parsed.success ||
    parsed.data.id !== event.eventId ||
    parsed.data.name !== event.eventName ||
    webhookPaymentIntentId(parsed.data) !== event.paymentIntentId
  ) {
    throw new AirwallexValidationError(
      "Stored payment notification is invalid.",
    );
  }
  return parsed.data;
}

async function processClaimedEvent(
  event: ClaimedAirwallexEvent,
): Promise<{ requiresReview: boolean }> {
  validateClaimedPayload(event);
  // Webhook delivery order is not guaranteed. The authenticated envelope
  // identifies the PI, but the worker always retrieves its latest state so a
  // delayed historical snapshot cannot downgrade or falsely quarantine it.
  const intent = await retrieveAirwallexPaymentIntent(event.paymentIntentId);
  const result = await applyAuthoritativeAirwallexPayment({
    authoritative: toAirwallexAuthoritativePayment(intent),
    source: "WEBHOOK",
    providerEvent: {
      recordId: event.id,
      eventId: event.eventId,
      eventName: event.eventName,
      lockToken: event.lockToken,
    },
  });
  return { requiresReview: result.requiresReview };
}

/** Drain a bounded batch. It is invoked by reconciliation, never fire-and-forget. */
export async function processPendingAirwallexWebhookEvents(
  batchSize = DEFAULT_EVENT_BATCH_SIZE,
): Promise<AirwallexEventProcessingSummary> {
  const take = Math.min(Math.max(Math.trunc(batchSize), 1), 25);
  const summary: AirwallexEventProcessingSummary = {
    claimed: 0,
    processed: 0,
    requiresReview: 0,
    retryScheduled: 0,
    persistenceErrors: 0,
  };

  // Lease just one event immediately before processing it. Pre-leasing a
  // whole batch can let later leases expire while earlier provider GETs retry.
  for (let index = 0; index < take; index += 1) {
    const [event] = await claimAirwallexWebhookEvents(1);
    if (!event) break;
    summary.claimed += 1;
    const startedAt = Date.now();
    try {
      const result = await processClaimedEvent(event);
      summary.processed += 1;
      if (result.requiresReview) summary.requiresReview += 1;
      logAirwallexEvent({
        event: "WEBHOOK_PROCESSED",
        paymentIntentId: event.paymentIntentId,
        providerEventId: event.eventId,
        eventName: event.eventName,
        durationMs: Date.now() - startedAt,
        requiresReview: result.requiresReview,
      });
    } catch (error) {
      const errorCode = processingErrorCode(error);
      try {
        await releaseAirwallexEventForRetry({
          id: event.id,
          lockToken: event.lockToken,
          processingAttempts: event.processingAttempts,
          errorCode,
          maxAttempts: MAX_EVENT_PROCESSING_ATTEMPTS,
        });
        if (event.processingAttempts >= MAX_EVENT_PROCESSING_ATTEMPTS) {
          summary.requiresReview += 1;
        } else {
          summary.retryScheduled += 1;
        }
      } catch {
        // The lease remains recoverable after its bounded timeout.
        summary.persistenceErrors += 1;
      }

      logAirwallexEvent({
        event: "WEBHOOK_PROCESSING_FAILED",
        paymentIntentId: event.paymentIntentId,
        providerEventId: event.eventId,
        eventName: event.eventName,
        durationMs: Date.now() - startedAt,
        errorCode,
        requiresReview:
          event.processingAttempts >= MAX_EVENT_PROCESSING_ATTEMPTS,
      });
    }
  }

  return summary;
}
