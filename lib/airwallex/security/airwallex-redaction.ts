import "server-only";

const SENSITIVE_KEY =
  /(api[-_]?key|client[-_]?id|client[-_]?secret|access[-_]?token|authorization|webhook[-_]?secret|reconciliation[-_]?secret|card|billing|address)/i;

export function sanitizeAirwallexCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "_");
  return normalized ? normalized.slice(0, 80) : null;
}

export function sanitizeAirwallexFailureMessage(
  value: unknown,
): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\bBearer\s+\S+/gi, "[REDACTED]")
    .trim();
  return normalized ? normalized.slice(0, 240) : null;
}

export function redactAirwallexValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAirwallexValue);
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && /\bBearer\s+\S+/i.test(value)) {
      return "[REDACTED]";
    }
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactAirwallexValue(entry),
    ]),
  );
}

export type AirwallexLogContext = {
  event: string;
  orderId?: string;
  paymentAttemptId?: string;
  paymentIntentId?: string;
  providerEventId?: string;
  eventName?: string;
  baseCurrency?: string;
  displayCurrency?: string;
  paymentCurrency?: string;
  baseAmount?: string;
  paymentAmount?: string;
  exchangeRate?: string;
  exchangeRateAt?: string;
  rateStale?: boolean;
  fromStatus?: string;
  toStatus?: string;
  durationMs?: number;
  errorCode?: string | null;
  requiresReview?: boolean;
};

export function logAirwallexEvent(context: AirwallexLogContext): void {
  const safe = redactAirwallexValue(context);
  if (context.errorCode || context.requiresReview) {
    console.warn("[payments.airwallex]", safe);
  } else {
    console.info("[payments.airwallex]", safe);
  }
}
