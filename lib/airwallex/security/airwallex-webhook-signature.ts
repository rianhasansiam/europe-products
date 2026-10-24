import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import {
  AirwallexReplayError,
  AirwallexSignatureError,
} from "../errors/airwallex.errors";

type VerifyWebhookSignatureInput = {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  toleranceSeconds: number;
  nowMs?: number;
};

/** Verify the exact timestamp + untouched body before JSON parsing. */
export function verifyAirwallexWebhookSignature({
  rawBody,
  timestamp,
  signature,
  secret,
  toleranceSeconds,
  nowMs = Date.now(),
}: VerifyWebhookSignatureInput): void {
  if (!timestamp || !signature || !/^\d{10,17}$/.test(timestamp)) {
    throw new AirwallexSignatureError();
  }
  if (!/^[0-9a-fA-F]{64}$/.test(signature)) {
    throw new AirwallexSignatureError();
  }

  const expected = createHmac("sha256", secret)
    .update(timestamp + rawBody, "utf8")
    .digest();
  const received = Buffer.from(signature, "hex");
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    throw new AirwallexSignatureError();
  }

  const timestampMs = Number(timestamp);
  if (!Number.isSafeInteger(timestampMs)) {
    throw new AirwallexReplayError();
  }
  const toleranceMs = toleranceSeconds * 1_000;
  if (Math.abs(nowMs - timestampMs) > toleranceMs) {
    throw new AirwallexReplayError();
  }
}
