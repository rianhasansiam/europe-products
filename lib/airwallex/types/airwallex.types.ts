import type { z } from "zod";

import type {
  AIRWALLEX_API_BASE_URLS,
  AIRWALLEX_KNOWN_PAYMENT_ATTEMPT_STATUSES,
  AIRWALLEX_KNOWN_PAYMENT_INTENT_STATUSES,
} from "../constants/airwallex.constants";
import type {
  airwallexAuthenticationResponseSchema,
  airwallexHostedPaymentPageConfigSchema,
  airwallexHostedPaymentPageRedirectOptionsSchema,
  airwallexInitiatePaymentRequestSchema,
  airwallexLatestPaymentAttemptSchema,
  airwallexPaymentAttemptStatusSchema,
  airwallexPaymentIntentCreateRequestSchema,
  airwallexPaymentIntentCreateResponseSchema,
  airwallexPaymentIntentRetrieveResponseSchema,
  airwallexPaymentIntentSchema,
  airwallexPaymentIntentStatusSchema,
} from "../schemas/airwallex.schemas";

export type AirwallexEnvironment = keyof typeof AIRWALLEX_API_BASE_URLS;
export type AirwallexJsEnvironment = "demo" | "prod";

export type AirwallexKnownPaymentIntentStatus =
  (typeof AIRWALLEX_KNOWN_PAYMENT_INTENT_STATUSES)[number];

/** Open provider value; compare against the known-status type before acting. */
export type AirwallexPaymentIntentStatus = z.infer<
  typeof airwallexPaymentIntentStatusSchema
>;

export type AirwallexKnownPaymentAttemptStatus =
  (typeof AIRWALLEX_KNOWN_PAYMENT_ATTEMPT_STATUSES)[number];

/** Open provider value for a nested PaymentAttempt status. */
export type AirwallexPaymentAttemptStatus = z.infer<
  typeof airwallexPaymentAttemptStatusSchema
>;

export type AirwallexAuthenticationResponse = z.infer<
  typeof airwallexAuthenticationResponseSchema
>;

export type AirwallexPaymentIntentCreateRequest = z.infer<
  typeof airwallexPaymentIntentCreateRequestSchema
>;

export type AirwallexPaymentIntent = z.infer<
  typeof airwallexPaymentIntentSchema
>;

export type AirwallexLatestPaymentAttempt = z.infer<
  typeof airwallexLatestPaymentAttemptSchema
>;

export type AirwallexPaymentIntentCreateResponse = z.infer<
  typeof airwallexPaymentIntentCreateResponseSchema
>;

export type AirwallexPaymentIntentRetrieveResponse = z.infer<
  typeof airwallexPaymentIntentRetrieveResponseSchema
>;

export type AirwallexInitiatePaymentRequest = z.infer<
  typeof airwallexInitiatePaymentRequestSchema
>;

export type AirwallexHostedPaymentPageConfig = z.infer<
  typeof airwallexHostedPaymentPageConfigSchema
>;

export type AirwallexHostedPaymentPageRedirectOptions = z.infer<
  typeof airwallexHostedPaymentPageRedirectOptionsSchema
>;
