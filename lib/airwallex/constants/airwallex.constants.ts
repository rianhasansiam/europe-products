/**
 * Public Airwallex protocol constants.
 *
 * This module deliberately contains no credentials or environment reads so it
 * is safe to import from both server and client module graphs.
 */

export const AIRWALLEX_PROVIDER = "AIRWALLEX" as const;

// New reservations use a distinct marker: older LOCAL_CREATED rows may already
// have an ambiguous provider request and must never be inferred safe to cancel.
export const AIRWALLEX_LOCAL_RESERVED_STATUS = "LOCAL_RESERVED" as const;
export const AIRWALLEX_CREATE_REQUESTED_STATUS = "CREATE_REQUESTED" as const;

export const AIRWALLEX_API_BASE_URLS = {
  sandbox: "https://api.sandbox.airwallex.com",
  production: "https://api.airwallex.com",
} as const;

export const AIRWALLEX_JS_ENVIRONMENTS = {
  sandbox: "demo",
  production: "prod",
} as const;

export const AIRWALLEX_API_PATHS = {
  authenticate: "/api/v1/authentication/login",
  createPaymentIntent: "/api/v1/pa/payment_intents/create",
  paymentIntents: "/api/v1/pa/payment_intents",
} as const;

export const AIRWALLEX_DEFAULT_HTTP_TIMEOUT_MS = 10_000;
export const AIRWALLEX_DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

/** Airwallex access tokens are documented as valid for 30 minutes. */
export const AIRWALLEX_ACCESS_TOKEN_LIFETIME_MS = 30 * 60_000;

/** PaymentIntent client secrets are documented as valid for 60 minutes. */
export const AIRWALLEX_CLIENT_SECRET_LIFETIME_MS = 60 * 60_000;

export const AIRWALLEX_REQUEST_ID_MAX_LENGTH = 64;
export const AIRWALLEX_MERCHANT_ORDER_ID_MAX_LENGTH = 64;
export const AIRWALLEX_DESCRIPTOR_MAX_LENGTH = 32;
export const AIRWALLEX_METADATA_MAX_ENTRIES = 50;
export const AIRWALLEX_METADATA_KEY_MAX_LENGTH = 50;
export const AIRWALLEX_METADATA_VALUE_MAX_LENGTH = 500;

/**
 * Known PaymentIntent states in the current Airwallex documentation.
 *
 * Provider payloads must still accept unknown non-empty status strings. This
 * tuple is only for exhaustive handling of states the application understands.
 */
export const AIRWALLEX_KNOWN_PAYMENT_INTENT_STATUSES = [
  "REQUIRES_PAYMENT_METHOD",
  "REQUIRES_CUSTOMER_ACTION",
  "REQUIRES_CAPTURE",
  "PENDING",
  "PENDING_REVIEW",
  "SUCCEEDED",
  "CANCELLED",
] as const;

/** Known statuses for the latest PaymentAttempt nested in a PaymentIntent. */
export const AIRWALLEX_KNOWN_PAYMENT_ATTEMPT_STATUSES = [
  "RECEIVED",
  "AUTHENTICATION_REDIRECTED",
  "PENDING_AUTHORIZATION",
  "AUTHORIZED",
  "CAPTURE_REQUESTED",
  "EXPIRED",
  "CANCELLED",
  "FAILED",
  "SETTLED",
  "PAID",
] as const;

export const AIRWALLEX_PAYMENT_INTENT_EVENT_NAMES = [
  "payment_intent.created",
  "payment_intent.requires_payment_method",
  "payment_intent.updated",
  "payment_intent.requires_capture",
  "payment_intent.requires_customer_action",
  "payment_intent.pending",
  "payment_intent.pending_review",
  "payment_intent.succeeded",
  "payment_intent.cancelled",
] as const;

export const AIRWALLEX_PAYMENT_ATTEMPT_FAILURE_EVENT_NAMES = [
  "payment_attempt.authentication_failed",
  "payment_attempt.authorization_failed",
] as const;
