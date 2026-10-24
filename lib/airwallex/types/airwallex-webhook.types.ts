import type { z } from "zod";

import type { AIRWALLEX_PAYMENT_INTENT_EVENT_NAMES } from "../constants/airwallex.constants";
import type {
  airwallexPaymentAttemptWebhookDataSchema,
  airwallexPaymentAttemptWebhookEnvelopeSchema,
  airwallexPaymentIntentWebhookDataSchema,
  airwallexPaymentIntentWebhookEnvelopeSchema,
  airwallexRawWebhookEnvelopeSchema,
  airwallexWebhookDeliveryHeadersSchema,
  airwallexWebhookEnvelopeSchema,
  airwallexWebhookEventNameSchema,
} from "../schemas/airwallex-webhook.schemas";

export type AirwallexKnownPaymentIntentEventName =
  (typeof AIRWALLEX_PAYMENT_INTENT_EVENT_NAMES)[number];

/** Open event value so newly introduced provider events can be quarantined. */
export type AirwallexWebhookEventName = z.infer<
  typeof airwallexWebhookEventNameSchema
>;

export type AirwallexRawWebhookEnvelope = z.input<
  typeof airwallexRawWebhookEnvelopeSchema
>;

export type AirwallexWebhookEnvelope = z.output<
  typeof airwallexWebhookEnvelopeSchema
>;

export type AirwallexPaymentIntentWebhookData = z.infer<
  typeof airwallexPaymentIntentWebhookDataSchema
>;

export type AirwallexPaymentIntentWebhookEnvelope = z.output<
  typeof airwallexPaymentIntentWebhookEnvelopeSchema
>;

export type AirwallexPaymentAttemptWebhookData = z.infer<
  typeof airwallexPaymentAttemptWebhookDataSchema
>;

export type AirwallexPaymentAttemptWebhookEnvelope = z.output<
  typeof airwallexPaymentAttemptWebhookEnvelopeSchema
>;

export type AirwallexWebhookDeliveryHeaders = z.infer<
  typeof airwallexWebhookDeliveryHeadersSchema
>;
