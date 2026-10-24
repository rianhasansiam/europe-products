import "server-only";

export type AirwallexReviewReason =
  | "PAYMENT_INTENT_MISMATCH"
  | "REQUEST_ID_MISMATCH"
  | "ORDER_ID_MISMATCH"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "PAYMENT_QUOTE_MISMATCH"
  | "ORDER_TOTAL_MISMATCH"
  | "ORDER_NOT_ELIGIBLE"
  | "MULTIPLE_SUCCESSFUL_PAYMENTS"
  | "UNKNOWN_PROVIDER_STATUS"
  | "UNKNOWN_PROVIDER_EVENT"
  | "ILLEGAL_STATE_TRANSITION";

export function safeAirwallexReviewMessage(
  reason: AirwallexReviewReason,
): string {
  switch (reason) {
    case "AMOUNT_MISMATCH":
    case "CURRENCY_MISMATCH":
    case "PAYMENT_QUOTE_MISMATCH":
    case "ORDER_TOTAL_MISMATCH":
      return "Payment details require manual verification.";
    case "UNKNOWN_PROVIDER_STATUS":
    case "UNKNOWN_PROVIDER_EVENT":
      return "Payment status requires manual verification.";
    default:
      return "Payment verification requires manual review.";
  }
}
