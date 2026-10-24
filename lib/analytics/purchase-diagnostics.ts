/** Matches the repository's console-based structured payment logging. */
const STATUSES = new Set([
  "built", "suppressed", "queued", "sdk_handoff", "duplicate", "unavailable",
  "delivery_failed", "script_failed", "consent_denied", "consent_revoked",
]);
const REASONS = new Set([
  "invalid_snapshot", "invalid_event_id", "invalid_event_time", "invalid_value",
  "zero_value_policy", "unsupported_currency", "ineligible_order", "unverified_payment",
  "payment_review", "payment_mismatch", "invalid_order_total", "invalid_payment_amount",
  "invalid_exchange_rate", "invalid_base_amount", "invalid_catalog_metadata", "event_id_mismatch",
]);

export type PurchaseDiagnostic = {
  eventId?: string;
  source: "browser" | "server";
  validation: "valid" | "invalid" | "ineligible";
  status: string;
  reason?: string;
};

/** Opt-in, allowlisted fields only. Never accept raw exceptions, URLs or user data. */
export function logPurchaseDiagnostic(context: PurchaseDiagnostic): void {
  try {
    const enabled = typeof window === "undefined"
      ? process.env.META_PURCHASE_DIAGNOSTICS === "true"
      : process.env.NEXT_PUBLIC_META_PURCHASE_DIAGNOSTICS === "true";
    if (!enabled) return;
    const entry = {
      event: "META_PURCHASE",
      source: context.source === "server" ? "server" : "browser",
      eventId: typeof context.eventId === "string" && /^purchase:[A-Za-z0-9_-]{1,128}$/.test(context.eventId)
        ? context.eventId : undefined,
      validation: ["valid", "invalid", "ineligible"].includes(context.validation) ? context.validation : "invalid",
      status: STATUSES.has(context.status) ? context.status : "unavailable",
      ...(context.reason ? { reason: REASONS.has(context.reason) ? context.reason : "invalid_snapshot" } : {}),
    };
    if (entry.validation === "invalid" || ["delivery_failed", "script_failed"].includes(entry.status)) {
      console.warn("[analytics.meta.purchase]", entry);
    } else {
      console.info("[analytics.meta.purchase]", entry);
    }
  } catch { /* Diagnostics cannot affect order or tracking delivery. */ }
}
