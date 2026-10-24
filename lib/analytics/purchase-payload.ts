import { isHistoricalCurrencyCode } from "@/lib/currency/config";
import { roundDecimalHalfUp } from "@/lib/currency/decimal";
import { buildEcommercePayload, type CommerceSnapshot, type EcommercePayload } from "./ecommerce";

/** Only the server's saved conversion snapshot crosses into the browser. */
export type PurchaseSnapshot = CommerceSnapshot & {
  eventId: string;
  /** Original verified payment time, in Unix seconds; never delivery time. */
  eventTime: number;
};

export type PurchaseValidationReason =
  | "invalid_snapshot" | "invalid_event_id" | "invalid_event_time"
  | "invalid_value" | "zero_value_policy" | "unsupported_currency";

export type PurchaseEventParameters = Pick<EcommercePayload, "value" | "currency"> &
  Partial<Omit<EcommercePayload, "value" | "currency">>;

export type PurchaseValidationResult =
  | { valid: true; payload: PurchaseSnapshot }
  | { valid: false; reason: PurchaseValidationReason };

/** Shared final boundary. Purchase must NEVER use the merchandise-sum fallback. */
export function validatePurchaseSnapshot(snapshot: unknown): PurchaseValidationResult {
  if (!snapshot || typeof snapshot !== "object") return { valid: false, reason: "invalid_snapshot" };
  const source = snapshot as Partial<PurchaseSnapshot>;
  if (typeof source.eventId !== "string" || !/^purchase:[A-Za-z0-9_-]{1,128}$/.test(source.eventId)) {
    return { valid: false, reason: "invalid_event_id" };
  }
  if (!Number.isSafeInteger(source.eventTime) || (source.eventTime ?? 0) <= 0 ||
      (source.eventTime ?? 0) > Math.floor(Date.now() / 1000) + 300) {
    return { valid: false, reason: "invalid_event_time" };
  }
  if (typeof source.value !== "number" || !Number.isFinite(source.value) || source.value < 0 ||
      !Number.isSafeInteger(Math.round(source.value * 100)) || roundDecimalHalfUp(source.value, 2) !== source.value) {
    return { valid: false, reason: "invalid_value" };
  }
  // Current online gateways require a positive charge. A free order remains
  // successful, but is not a paid conversion under this store's existing policy.
  if (source.value === 0) return { valid: false, reason: "zero_value_policy" };
  if (!isHistoricalCurrencyCode(source.currency)) return { valid: false, reason: "unsupported_currency" };

  // Catalog metadata is optional. Invalid/deleted catalog links must not erase
  // an otherwise valid paid conversion; the adapter includes it only if valid.
  return { valid: true, payload: {
    eventId: source.eventId,
    eventTime: source.eventTime!,
    value: source.value,
    currency: source.currency,
    items: Array.isArray(source.items) ? source.items : [],
  } };
}

/** Same required parameters for every delivery adapter; no amount calculation. */
export function buildPurchaseEventParameters(snapshot: unknown): PurchaseEventParameters | null {
  const result = validatePurchaseSnapshot(snapshot);
  if (!result.valid) return null;
  const { items, value, currency } = result.payload;
  try {
    const parameters = buildEcommercePayload(items, currency, value);
    if (!parameters) return { value, currency };
    if (typeof parameters.content_name !== "string") delete parameters.content_name;
    return parameters;
  } catch {
    return { value, currency };
  }
}
