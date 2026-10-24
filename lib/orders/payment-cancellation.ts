import { AIRWALLEX_LOCAL_RESERVED_STATUS } from "@/lib/airwallex/constants/airwallex.constants";

const GATEWAY_MANAGED_PAYMENT_METHODS = new Set([
  "SSLCOMMERZ",
  "AIRWALLEX",
]);

const TERMINAL_AIRWALLEX_CANCELLATION_STATUSES = new Set([
  "CANCELLED",
  "REFUNDED",
  "EXPIRED",
]);

const AMBIGUOUS_AIRWALLEX_CREATE_STATUSES = new Set([408, 409, 425, 429]);
const AIRWALLEX_CREATE_REJECTION_PATTERN = /^CREATE_REJECTED_(\d{3})$/;

export type CancellationPaymentSnapshot = {
  provider: string;
  status: string;
  requiresReview: boolean;
  transactionId: string | null;
  providerStatus: string | null;
};

/** True only for newly reserved attempts that never crossed the HTTP boundary. */
export function isNeverInitiatedAirwallexPayment(payment: CancellationPaymentSnapshot): boolean {
  return payment.provider === "AIRWALLEX" && payment.status === "CREATED" &&
    payment.transactionId === null && payment.providerStatus === AIRWALLEX_LOCAL_RESERVED_STATUS &&
    !payment.requiresReview;
}

export function isGatewayManagedPaymentMethod(method: string): boolean {
  return GATEWAY_MANAGED_PAYMENT_METHODS.has(method);
}

function isDefinitiveUnboundAirwallexCreateRejection(
  payment: CancellationPaymentSnapshot,
): boolean {
  if (
    payment.status !== "FAILED" ||
    payment.transactionId !== null ||
    payment.providerStatus === null
  ) {
    return false;
  }

  const match = AIRWALLEX_CREATE_REJECTION_PATTERN.exec(
    payment.providerStatus,
  );
  if (!match) return false;

  const providerStatus = Number(match[1]);
  return (
    providerStatus >= 400 &&
    providerStatus < 500 &&
    !AMBIGUOUS_AIRWALLEX_CREATE_STATUSES.has(providerStatus)
  );
}

export function gatewayPaymentBlocksCancellation(input: {
  paymentMethod: string;
  paymentStatus: string;
  payments: readonly CancellationPaymentSnapshot[];
}): boolean {
  if (!isGatewayManagedPaymentMethod(input.paymentMethod)) return false;
  if (input.paymentStatus === "PAID") return true;

  return input.payments
    .filter((payment) => payment.provider === input.paymentMethod)
    .some((payment) => {
      if (payment.status === "SUCCESS" || payment.requiresReview) return true;
      if (input.paymentMethod !== "AIRWALLEX") return false;

      if (isNeverInitiatedAirwallexPayment(payment)) return false;

      // Initiation releases the order lock during the provider HTTP request,
      // so even CREATED can be in-flight. A failed, provider-bound attempt can
      // also leave its PaymentIntent reusable. The only safe FAILED exception
      // is a locally recorded, definitive create rejection: Airwallex proved
      // that no PaymentIntent exists for that request identity.
      if (isDefinitiveUnboundAirwallexCreateRejection(payment)) return false;

      return !TERMINAL_AIRWALLEX_CANCELLATION_STATUSES.has(payment.status);
    });
}
