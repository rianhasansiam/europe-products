import { describe, expect, it } from "vitest";

import {
  airwallexAuthenticationResponseSchema,
  airwallexHostedPaymentPageConfigSchema,
  airwallexInitiatePaymentRequestSchema,
  airwallexPaymentIntentCreateRequestSchema,
} from "../schemas/airwallex.schemas";
import {
  airwallexPaymentAttemptWebhookEnvelopeSchema,
  airwallexPaymentIntentWebhookEnvelopeSchema,
  airwallexProcessableWebhookEnvelopeSchema,
} from "../schemas/airwallex-webhook.schemas";

const paymentIntent = {
  id: "int_example_123",
  request_id: "123e4567-e89b-42d3-a456-426614174000",
  amount: 49.95,
  currency: "USD",
  merchant_order_id: "order_123",
  status: "PENDING",
  created_at: "2026-08-04T10:00:00Z",
  updated_at: "2026-08-04T10:01:00Z",
};

describe("Airwallex provider schemas", () => {
  it("strips unrecognized authentication response fields", () => {
    const parsed = airwallexAuthenticationResponseSchema.parse({
      token: "access-token",
      expires_at: "2026-08-04T10:30:00Z",
      client_id: "must-not-propagate",
      internal_debug: true,
    });

    expect(parsed).toEqual({
      token: "access-token",
      expires_at: "2026-08-04T10:30:00Z",
    });
  });

  it("normalizes legacy webhook account IDs and strips unsafe provider data", () => {
    const parsed = airwallexPaymentIntentWebhookEnvelopeSchema.parse({
      id: "evt_example_123",
      name: "payment_intent.pending",
      accountId: "acct_example",
      org_id: null,
      created_at: "2026-08-04T10:01:00Z",
      version: "2026-07-17",
      debug: "drop-me",
      data: {
        object: {
          ...paymentIntent,
          client_secret: "must-not-be-persisted",
          billing: { address: "must-not-be-persisted" },
        },
        raw_provider_response: "drop-me",
      },
    });

    expect(parsed.account_id).toBe("acct_example");
    expect(parsed).not.toHaveProperty("accountId");
    expect(parsed).not.toHaveProperty("debug");
    expect(parsed.data).not.toHaveProperty("raw_provider_response");
    expect(parsed.data.object).not.toHaveProperty("client_secret");
    expect(parsed.data.object).not.toHaveProperty("billing");
  });

  it.each([
    "payment_attempt.authentication_failed",
    "payment_attempt.authorization_failed",
  ])("accepts and sanitizes the %s envelope", (eventName) => {
    const parsed = airwallexPaymentAttemptWebhookEnvelopeSchema.parse({
      id: `evt_${eventName.replaceAll(".", "_")}`,
      name: eventName,
      account_id: "acct_example",
      created_at: "2026-08-04T10:02:00Z",
      version: "2026-07-17",
      provider_debug: "drop-me",
      data: {
        object: {
          id: "att_example_123",
          payment_intent_id: paymentIntent.id,
          status: "FAILED",
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          failure_code: "authorization_declined",
          failure_details: {
            message: "Bearer secret-token",
            billing_address: "private-address",
          },
          card: { number: "4111111111111111" },
          client_secret: "must-not-survive",
        },
        raw_provider_response: "drop-me",
      },
    });

    expect(parsed.name).toBe(eventName);
    expect(parsed).not.toHaveProperty("provider_debug");
    expect(parsed.data).not.toHaveProperty("raw_provider_response");
    expect(parsed.data.object).toEqual({
      id: "att_example_123",
      payment_intent_id: paymentIntent.id,
      status: "FAILED",
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      failure_code: "authorization_declined",
    });
    expect(
      airwallexProcessableWebhookEnvelopeSchema.safeParse(parsed).success,
    ).toBe(true);
  });

  it("accepts a forward-compatible PaymentIntent event and status", () => {
    const parsed = airwallexPaymentIntentWebhookEnvelopeSchema.parse({
      id: "evt_future_payment_intent_state",
      name: "payment_intent.awaiting_new_provider_step",
      account_id: "acct_example",
      created_at: "2026-08-04T10:03:00Z",
      version: "2026-07-17",
      data: {
        object: {
          ...paymentIntent,
          status: "AWAITING_NEW_PROVIDER_STEP",
        },
      },
    });

    expect(parsed.name).toBe("payment_intent.awaiting_new_provider_step");
    expect(parsed.data.object.status).toBe("AWAITING_NEW_PROVIDER_STEP");
  });

  it("strips browser-supplied payment authority fields", () => {
    const parsed = airwallexInitiatePaymentRequestSchema.parse({
      orderId: "order_123",
      amount: 0.01,
      currency: "USD",
      userId: "another-user",
    });

    expect(parsed).toEqual({ orderId: "order_123" });
  });

  it("keeps the server PaymentIntent create request strict", () => {
    const result = airwallexPaymentIntentCreateRequestSchema.safeParse({
      request_id: paymentIntent.request_id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      merchant_order_id: paymentIntent.merchant_order_id,
      access_token: "must-never-be-in-the-body",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a zero-value PaymentIntent create request", () => {
    const result = airwallexPaymentIntentCreateRequestSchema.safeParse({
      request_id: paymentIntent.request_id,
      amount: 0,
      currency: paymentIntent.currency,
      merchant_order_id: paymentIntent.merchant_order_id,
    });

    expect(result.success).toBe(false);
  });

  it("accepts sandbox localhost return URLs across initiation boundaries", () => {
    const returnUrl =
      "http://localhost:3000/orders/payment-return?orderId=order_123";

    expect(
      airwallexPaymentIntentCreateRequestSchema.safeParse({
        request_id: paymentIntent.request_id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        merchant_order_id: paymentIntent.merchant_order_id,
        return_url: returnUrl,
      }).success,
    ).toBe(true);

    expect(
      airwallexHostedPaymentPageConfigSchema.safeParse({
        intentId: paymentIntent.id,
        clientSecret: "client-secret",
        currency: paymentIntent.currency,
        environment: "demo",
        successUrl: returnUrl,
        cancelUrl: `${returnUrl}&flow=cancelled`,
      }).success,
    ).toBe(true);
  });

  it.each([
    "http://shop.example.test/orders/payment-return",
    "https://user:password@shop.example.test/orders/payment-return",
    "https://shop.example.test/orders/payment-return#secret",
  ])("rejects an unsafe PaymentIntent return URL: %s", (returnUrl) => {
    expect(
      airwallexPaymentIntentCreateRequestSchema.safeParse({
        request_id: paymentIntent.request_id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        merchant_order_id: paymentIntent.merchant_order_id,
        return_url: returnUrl,
      }).success,
    ).toBe(false);
  });

  it("requires HTTPS return URLs for the production HPP environment", () => {
    expect(
      airwallexHostedPaymentPageConfigSchema.safeParse({
        intentId: paymentIntent.id,
        clientSecret: "client-secret",
        currency: paymentIntent.currency,
        environment: "prod",
        successUrl:
          "http://localhost:3000/orders/payment-return?orderId=order_123",
      }).success,
    ).toBe(false);
  });
});
