import { z } from "zod";

import {
  AIRWALLEX_PAYMENT_ATTEMPT_FAILURE_EVENT_NAMES,
  AIRWALLEX_PAYMENT_INTENT_EVENT_NAMES,
} from "../constants/airwallex.constants";
import {
  airwallexAmountSchema,
  airwallexCurrencySchema,
  airwallexPaymentAttemptStatusSchema,
  airwallexPaymentIntentIdSchema,
  airwallexPaymentIntentSchema,
  airwallexTimestampSchema,
} from "./airwallex.schemas";

const MAX_WEBHOOK_IDENTIFIER_LENGTH = 255;
const MAX_EVENT_NAME_LENGTH = 200;

const optionalEnvelopeOwnerIdSchema = z
  .string()
  .trim()
  .max(MAX_WEBHOOK_IDENTIFIER_LENGTH)
  .nullable()
  .optional();

export const airwallexWebhookEventIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_WEBHOOK_IDENTIFIER_LENGTH);

/** Event names remain open so newly added Airwallex events can be quarantined. */
export const airwallexWebhookEventNameSchema = z
  .string()
  .trim()
  .min(3)
  .max(MAX_EVENT_NAME_LENGTH)
  .regex(/^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+$/);

export const airwallexKnownPaymentIntentEventNameSchema = z.enum(
  AIRWALLEX_PAYMENT_INTENT_EVENT_NAMES,
);

export const airwallexKnownPaymentAttemptFailureEventNameSchema = z.enum(
  AIRWALLEX_PAYMENT_ATTEMPT_FAILURE_EVENT_NAMES,
);

export const airwallexWebhookVersionSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/);

/** Unix epoch milliseconds supplied in the x-timestamp delivery header. */
export const airwallexWebhookTimestampHeaderSchema = z
  .string()
  .regex(/^\d{10,17}$/);

/** SHA-256 HMAC encoded as the documented hexadecimal x-signature value. */
export const airwallexWebhookSignatureHeaderSchema = z
  .string()
  .regex(/^[A-Fa-f0-9]{64}$/);

export const airwallexWebhookDeliveryHeadersSchema = z
  .object({
    "x-timestamp": airwallexWebhookTimestampHeaderSchema,
    "x-signature": airwallexWebhookSignatureHeaderSchema,
  })
  .strict();

/**
 * Raw provider envelope. `accountId` is accepted only as a compatibility
 * fallback for subscriptions on a legacy webhook version.
 */
export const airwallexRawWebhookEnvelopeSchema = z
  .object({
    id: airwallexWebhookEventIdSchema,
    name: airwallexWebhookEventNameSchema,
    account_id: optionalEnvelopeOwnerIdSchema,
    accountId: optionalEnvelopeOwnerIdSchema,
    org_id: optionalEnvelopeOwnerIdSchema,
    data: z.unknown(),
    created_at: airwallexTimestampSchema,
    version: airwallexWebhookVersionSchema,
  })
  .strip()
  .superRefine((event, context) => {
    if (!Object.prototype.hasOwnProperty.call(event, "data")) {
      context.addIssue({
        code: "custom",
        path: ["data"],
        message: "Webhook data is required.",
      });
    }

    const currentAccountId = event.account_id || undefined;
    const legacyAccountId = event.accountId || undefined;
    if (
      currentAccountId !== undefined &&
      legacyAccountId !== undefined &&
      currentAccountId !== legacyAccountId
    ) {
      context.addIssue({
        code: "custom",
        path: ["account_id"],
        message: "Current and legacy webhook account IDs do not match.",
      });
    }
  });

/**
 * Canonical envelope consumed by ingestion. Legacy camelCase account IDs are
 * removed after being copied to the current snake_case field.
 */
export const airwallexWebhookEnvelopeSchema =
  airwallexRawWebhookEnvelopeSchema.transform(
    ({ accountId, account_id, org_id, ...event }) => ({
      ...event,
      account_id: account_id || accountId || undefined,
      org_id: org_id || undefined,
    }),
  );

/** Sanitized PaymentIntent snapshot; unknown provider fields are stripped. */
export const airwallexPaymentIntentWebhookDataSchema = z
  .object({
    object: airwallexPaymentIntentSchema,
  })
  .strip();

const normalizedPaymentIntentEnvelopeSchema = z
  .object({
    id: airwallexWebhookEventIdSchema,
    name: airwallexWebhookEventNameSchema.refine(
      (name) => name.startsWith("payment_intent."),
      "Expected a PaymentIntent webhook event.",
    ),
    account_id: z.union([
      z.string().trim().min(1).max(MAX_WEBHOOK_IDENTIFIER_LENGTH),
      z.undefined(),
    ]),
    org_id: z.union([
      z.string().trim().min(1).max(MAX_WEBHOOK_IDENTIFIER_LENGTH),
      z.undefined(),
    ]),
    data: airwallexPaymentIntentWebhookDataSchema,
    created_at: airwallexTimestampSchema,
    version: airwallexWebhookVersionSchema,
  })
  .strict();

/**
 * Current PaymentIntent envelope with legacy account-ID normalization. Event
 * names and PaymentIntent statuses deliberately remain forward-compatible.
 */
export const airwallexPaymentIntentWebhookEnvelopeSchema =
  airwallexWebhookEnvelopeSchema.pipe(
    normalizedPaymentIntentEnvelopeSchema,
  );

/** Minimal, non-sensitive PaymentAttempt projection needed to find its PI. */
export const airwallexPaymentAttemptWebhookDataSchema = z
  .object({
    object: z
      .object({
        id: z.string().trim().min(1).max(MAX_WEBHOOK_IDENTIFIER_LENGTH),
        payment_intent_id: airwallexPaymentIntentIdSchema,
        status: airwallexPaymentAttemptStatusSchema,
        amount: airwallexAmountSchema.optional(),
        currency: airwallexCurrencySchema.optional(),
        failure_code: z.string().trim().min(1).max(200).optional(),
        created_at: airwallexTimestampSchema.optional(),
        updated_at: airwallexTimestampSchema.optional(),
      })
      .strip(),
  })
  .strip();

const normalizedPaymentAttemptEnvelopeSchema = z
  .object({
    id: airwallexWebhookEventIdSchema,
    name: airwallexWebhookEventNameSchema.refine(
      (name) => name.startsWith("payment_attempt."),
      "Expected a PaymentAttempt webhook event.",
    ),
    account_id: z.union([
      z.string().trim().min(1).max(MAX_WEBHOOK_IDENTIFIER_LENGTH),
      z.undefined(),
    ]),
    org_id: z.union([
      z.string().trim().min(1).max(MAX_WEBHOOK_IDENTIFIER_LENGTH),
      z.undefined(),
    ]),
    data: airwallexPaymentAttemptWebhookDataSchema,
    created_at: airwallexTimestampSchema,
    version: airwallexWebhookVersionSchema,
  })
  .strict();

export const airwallexPaymentAttemptWebhookEnvelopeSchema =
  airwallexWebhookEnvelopeSchema.pipe(
    normalizedPaymentAttemptEnvelopeSchema,
  );

/** Events whose object can be bound to a SexToy PaymentIntent. */
export const airwallexProcessableWebhookEnvelopeSchema = z.union([
  airwallexPaymentIntentWebhookEnvelopeSchema,
  airwallexPaymentAttemptWebhookEnvelopeSchema,
]);
