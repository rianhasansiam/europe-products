import { z } from "zod";
import { BASE_CURRENCY } from "@/lib/currency/config";

import {
  AIRWALLEX_DESCRIPTOR_MAX_LENGTH,
  AIRWALLEX_KNOWN_PAYMENT_ATTEMPT_STATUSES,
  AIRWALLEX_KNOWN_PAYMENT_INTENT_STATUSES,
  AIRWALLEX_MERCHANT_ORDER_ID_MAX_LENGTH,
  AIRWALLEX_METADATA_KEY_MAX_LENGTH,
  AIRWALLEX_METADATA_MAX_ENTRIES,
  AIRWALLEX_METADATA_VALUE_MAX_LENGTH,
  AIRWALLEX_REQUEST_ID_MAX_LENGTH,
} from "../constants/airwallex.constants";
import {
  isAirwallexHttpsUrl,
  isAirwallexReturnUrl,
} from "../security/airwallex-return-url";

const MAX_PROVIDER_IDENTIFIER_LENGTH = 255;
const MAX_PROVIDER_SECRET_LENGTH = 8_192;
const MAX_URL_LENGTH = 2_048;
const MAX_STATUS_LENGTH = 100;
const MAX_TIMESTAMP_LENGTH = 64;

function isValidTimestamp(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})$/.test(
      value,
    ) && Number.isFinite(Date.parse(value))
  );
}

export const airwallexTimestampSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_TIMESTAMP_LENGTH)
  .refine(isValidTimestamp, "Invalid Airwallex timestamp.");

export const airwallexHttpsUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_URL_LENGTH)
  .refine(isAirwallexHttpsUrl, "Expected a credential-free HTTPS URL.");

export const airwallexReturnUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_URL_LENGTH)
  .refine(
    (value) => isAirwallexReturnUrl(value, "sandbox"),
    "Expected a credential-free HTTPS URL or a sandbox loopback HTTP URL.",
  );

export const airwallexCurrencySchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/);

export const airwallexCountryCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{2}$/);

export const airwallexRequestIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(AIRWALLEX_REQUEST_ID_MAX_LENGTH);

export const airwallexMerchantOrderIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(AIRWALLEX_MERCHANT_ORDER_ID_MAX_LENGTH);

export const airwallexPaymentIntentIdSchema = z
  .string()
  .trim()
  .min(5)
  .max(MAX_PROVIDER_IDENTIFIER_LENGTH)
  .regex(/^int_[A-Za-z0-9_-]+$/);

export const airwallexClientSecretSchema = z
  .string()
  .min(1)
  .max(MAX_PROVIDER_SECRET_LENGTH);

export const airwallexAccessTokenSchema = z
  .string()
  .min(1)
  .max(MAX_PROVIDER_SECRET_LENGTH);

export const airwallexAmountSchema = z
  .number()
  .finite()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

/**
 * Provider statuses are open strings because Airwallex explicitly documents
 * that the returned status list is not exhaustive.
 */
export const airwallexPaymentIntentStatusSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_STATUS_LENGTH);

export const airwallexKnownPaymentIntentStatusSchema = z.enum(
  AIRWALLEX_KNOWN_PAYMENT_INTENT_STATUSES,
);

export const airwallexPaymentAttemptStatusSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_STATUS_LENGTH);

export const airwallexKnownPaymentAttemptStatusSchema = z.enum(
  AIRWALLEX_KNOWN_PAYMENT_ATTEMPT_STATUSES,
);

export const airwallexMetadataSchema = z
  .record(
    z.string().min(1).max(AIRWALLEX_METADATA_KEY_MAX_LENGTH),
    z.string().max(AIRWALLEX_METADATA_VALUE_MAX_LENGTH),
  )
  .superRefine((metadata, context) => {
    if (Object.keys(metadata).length > AIRWALLEX_METADATA_MAX_ENTRIES) {
      context.addIssue({
        code: "too_big",
        maximum: AIRWALLEX_METADATA_MAX_ENTRIES,
        origin: "object",
        inclusive: true,
        message: `Metadata cannot contain more than ${AIRWALLEX_METADATA_MAX_ENTRIES} entries.`,
      });
    }
  });

/** The authentication endpoint response; unrecognized provider fields strip. */
export const airwallexAuthenticationResponseSchema = z
  .object({
    token: airwallexAccessTokenSchema,
    expires_at: airwallexTimestampSchema,
  })
  .strip();

/** Minimal server-generated PaymentIntent create request for HPP checkout. */
export const airwallexPaymentIntentCreateRequestSchema = z
  .object({
    request_id: airwallexRequestIdSchema,
    amount: airwallexAmountSchema.positive(),
    currency: z.literal(BASE_CURRENCY),
    merchant_order_id: airwallexMerchantOrderIdSchema,
    return_url: airwallexReturnUrlSchema.optional(),
    descriptor: z
      .string()
      .trim()
      .min(1)
      .max(AIRWALLEX_DESCRIPTOR_MAX_LENGTH)
      .optional(),
    customer_id: z
      .string()
      .trim()
      .min(1)
      .max(MAX_PROVIDER_IDENTIFIER_LENGTH)
      .optional(),
    metadata: airwallexMetadataSchema.optional(),
  })
  .strict();

const airwallexFailureDetailsSchema = z
  .object({
    code: z.string().trim().min(1).max(200).optional(),
    message: z.string().trim().min(1).max(1_000).optional(),
    trace_id: z.string().trim().min(1).max(255).optional(),
  })
  .strip();

export const airwallexLatestPaymentAttemptSchema = z
  .object({
    id: z.string().trim().min(1).max(MAX_PROVIDER_IDENTIFIER_LENGTH),
    status: airwallexPaymentAttemptStatusSchema,
    payment_intent_id: airwallexPaymentIntentIdSchema.optional(),
    amount: airwallexAmountSchema.optional(),
    captured_amount: airwallexAmountSchema.optional(),
    currency: airwallexCurrencySchema.optional(),
    failure_code: z.string().trim().min(1).max(200).optional(),
    failure_details: airwallexFailureDetailsSchema.optional(),
    created_at: airwallexTimestampSchema.optional(),
    updated_at: airwallexTimestampSchema.optional(),
  })
  .strip();

/**
 * Sanitized PaymentIntent fields used for reconciliation and webhook handling.
 * Added provider fields are accepted and stripped from the parsed result.
 */
export const airwallexPaymentIntentSchema = z
  .object({
    id: airwallexPaymentIntentIdSchema,
    request_id: airwallexRequestIdSchema,
    amount: airwallexAmountSchema,
    captured_amount: airwallexAmountSchema.optional(),
    currency: airwallexCurrencySchema,
    merchant_order_id: airwallexMerchantOrderIdSchema,
    status: airwallexPaymentIntentStatusSchema,
    latest_payment_attempt: airwallexLatestPaymentAttemptSchema
      .nullable()
      .optional(),
    metadata: airwallexMetadataSchema.optional(),
    created_at: airwallexTimestampSchema,
    updated_at: airwallexTimestampSchema,
    cancelled_at: airwallexTimestampSchema.optional(),
  })
  .strip();

/** Create must return a fresh browser client secret. */
export const airwallexPaymentIntentCreateResponseSchema =
  airwallexPaymentIntentSchema.extend({
    client_secret: airwallexClientSecretSchema,
  });

/** Retrieve may return the same client secret, but it is not required to reconcile. */
export const airwallexPaymentIntentRetrieveResponseSchema =
  airwallexPaymentIntentSchema.extend({
    client_secret: airwallexClientSecretSchema.optional(),
  });

/** Only the order identifier is accepted from the shopper. */
export const airwallexInitiatePaymentRequestSchema = z
  .object({
    orderId: z.string().trim().min(1).max(MAX_PROVIDER_IDENTIFIER_LENGTH),
  })
  // Browser-supplied amount/currency fields are deliberately discarded. The
  // initiation service reads every monetary value from the persisted order.
  .strip();

/**
 * Safe browser payload returned after the server creates a PaymentIntent.
 * It intentionally excludes every Airwallex server credential and access token.
 */
export const airwallexHostedPaymentPageConfigSchema = z
  .object({
    intentId: airwallexPaymentIntentIdSchema,
    clientSecret: airwallexClientSecretSchema,
    currency: airwallexCurrencySchema,
    environment: z.enum(["demo", "prod"]),
    successUrl: airwallexReturnUrlSchema,
    cancelUrl: airwallexReturnUrlSchema.optional(),
    countryCode: airwallexCountryCodeSchema.optional(),
  })
  .strict()
  .superRefine((config, context) => {
    if (config.environment !== "prod") return;
    for (const field of ["successUrl", "cancelUrl"] as const) {
      const value = config[field];
      if (value && !isAirwallexHttpsUrl(value)) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Production Airwallex return URLs must use HTTPS.",
        });
      }
    }
  });

/** Exact non-deprecated HPP redirect properties used by Airwallex.js. */
export const airwallexHostedPaymentPageRedirectOptionsSchema = z
  .object({
    mode: z.literal("payment"),
    intent_id: airwallexPaymentIntentIdSchema,
    client_secret: airwallexClientSecretSchema,
    currency: airwallexCurrencySchema,
    successUrl: airwallexReturnUrlSchema,
    cancelUrl: airwallexReturnUrlSchema.optional(),
    country_code: airwallexCountryCodeSchema.optional(),
  })
  .strict();
