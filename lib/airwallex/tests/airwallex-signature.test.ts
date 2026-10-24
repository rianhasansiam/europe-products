import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  AirwallexReplayError,
  AirwallexSignatureError,
} from "../errors/airwallex.errors";
import { verifyAirwallexWebhookSignature } from "../security/airwallex-webhook-signature";

const secret = "test-webhook-secret-with-enough-entropy";
const nowMs = 1_800_000_000_000;

function sign(timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret)
    .update(timestamp + rawBody, "utf8")
    .digest("hex");
}

function verify(timestamp: string, rawBody: string, signature = sign(timestamp, rawBody)) {
  return verifyAirwallexWebhookSignature({
    rawBody,
    timestamp,
    signature,
    secret,
    toleranceSeconds: 300,
    nowMs,
  });
}

describe("verifyAirwallexWebhookSignature", () => {
  it("accepts the exact timestamp plus untouched UTF-8 body bytes", () => {
    const timestamp = String(nowMs);
    const rawBody = '{\r\n  "message": "ঢাকা", "amount": 10.00\r\n}\r\n';

    expect(() => verify(timestamp, rawBody)).not.toThrow();
  });

  it("rejects modified or parsed-and-reserialized JSON", () => {
    const timestamp = String(nowMs);
    const rawBody = '{"amount": 10.00, "currency": "USD"}\n';
    const signature = sign(timestamp, rawBody);
    const reserialized = JSON.stringify(JSON.parse(rawBody));

    expect(() => verify(timestamp, reserialized, signature)).toThrow(
      AirwallexSignatureError,
    );
  });

  it("rejects the wrong body-plus-timestamp concatenation order", () => {
    const timestamp = String(nowMs);
    const rawBody = '{"id":"evt_123"}';
    const wrongSignature = createHmac("sha256", secret)
      .update(rawBody + timestamp, "utf8")
      .digest("hex");

    expect(() => verify(timestamp, rawBody, wrongSignature)).toThrow(
      AirwallexSignatureError,
    );
  });

  it("rejects missing, malformed, and unequal-length signatures", () => {
    const timestamp = String(nowMs);
    const rawBody = "{}";
    const validSignature = sign(timestamp, rawBody);

    expect(() =>
      verifyAirwallexWebhookSignature({
        rawBody,
        timestamp: null,
        signature: validSignature,
        secret,
        toleranceSeconds: 300,
        nowMs,
      }),
    ).toThrow(AirwallexSignatureError);
    expect(() => verify(timestamp, rawBody, "ab".repeat(31))).toThrow(
      AirwallexSignatureError,
    );
    expect(() => verify(timestamp, rawBody, "z".repeat(64))).toThrow(
      AirwallexSignatureError,
    );
  });

  it("rejects expired and excessively future-dated deliveries", () => {
    const expired = String(nowMs - 300_001);
    const future = String(nowMs + 300_001);

    expect(() => verify(expired, "{}")).toThrow(AirwallexReplayError);
    expect(() => verify(future, "{}")).toThrow(AirwallexReplayError);
  });

  it("accepts a delivery exactly on the configured tolerance boundary", () => {
    const boundary = String(nowMs - 300_000);

    expect(() => verify(boundary, "{}")).not.toThrow();
  });
});
