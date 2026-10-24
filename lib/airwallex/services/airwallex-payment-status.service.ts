import "server-only";

import type { PaymentTransactionStatus } from "@/app/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  paymentCustomerOrderWhere,
  type PaymentOrderCustomer,
} from "@/lib/payments/core/payment-order-customer";

import {
  AIRWALLEX_KNOWN_PAYMENT_INTENT_STATUSES,
  AIRWALLEX_PROVIDER,
} from "../constants/airwallex.constants";
import { retrieveAirwallexPaymentIntent } from "./airwallex-payment-intent.service";
import {
  applyAuthoritativeAirwallexPayment,
  toAirwallexAuthoritativePayment,
} from "./airwallex-payment-verification.service";
import { logAirwallexEvent } from "../security/airwallex-redaction";

const KNOWN_PROVIDER_STATUS = new Set<string>(
  AIRWALLEX_KNOWN_PAYMENT_INTENT_STATUSES,
);
export function mapAirwallexPaymentStatus(
  providerStatus: string,
): PaymentTransactionStatus {
  if (!KNOWN_PROVIDER_STATUS.has(providerStatus)) return "REQUIRES_REVIEW";
  switch (providerStatus) {
    case "REQUIRES_PAYMENT_METHOD":
      return "REQUIRES_PAYMENT_METHOD";
    case "REQUIRES_CUSTOMER_ACTION":
    case "REQUIRES_CAPTURE":
      return "PROCESSING";
    case "PENDING":
      return "PENDING";
    case "PENDING_REVIEW":
      return "PENDING_REVIEW";
    case "SUCCEEDED":
      return "SUCCESS";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "REQUIRES_REVIEW";
  }
}

const LEGAL_TRANSITIONS: Record<
  PaymentTransactionStatus,
  ReadonlySet<PaymentTransactionStatus>
> = {
  CREATED: new Set([
    "CREATED",
    "REQUIRES_PAYMENT_METHOD",
    "PENDING",
    "PROCESSING",
    "PENDING_REVIEW",
    "SUCCESS",
    "FAILED",
    "CANCELLED",
    "REQUIRES_REVIEW",
  ]),
  REQUIRES_PAYMENT_METHOD: new Set([
    "REQUIRES_PAYMENT_METHOD",
    "PENDING",
    "PROCESSING",
    "PENDING_REVIEW",
    "SUCCESS",
    "FAILED",
    "CANCELLED",
    "REQUIRES_REVIEW",
  ]),
  PENDING: new Set([
    "REQUIRES_PAYMENT_METHOD",
    "PENDING",
    "PROCESSING",
    "PENDING_REVIEW",
    "SUCCESS",
    "FAILED",
    "CANCELLED",
    "REQUIRES_REVIEW",
  ]),
  PROCESSING: new Set([
    "REQUIRES_PAYMENT_METHOD",
    "PROCESSING",
    "PENDING",
    "PENDING_REVIEW",
    "SUCCESS",
    "FAILED",
    "CANCELLED",
    "REQUIRES_REVIEW",
  ]),
  PENDING_REVIEW: new Set([
    "REQUIRES_PAYMENT_METHOD",
    "PENDING",
    "PROCESSING",
    "PENDING_REVIEW",
    "SUCCESS",
    "FAILED",
    "CANCELLED",
    "REQUIRES_REVIEW",
  ]),
  REQUIRES_REVIEW: new Set([
    "REQUIRES_REVIEW",
    "SUCCESS",
    "REFUNDED",
  ]),
  SUCCESS: new Set(["SUCCESS", "REFUNDED"]),
  FAILED: new Set([
    "FAILED",
    "CANCELLED",
    "PENDING_REVIEW",
    "REQUIRES_REVIEW",
    "SUCCESS",
    "REFUNDED",
  ]),
  CANCELLED: new Set([
    "CANCELLED",
    "PENDING_REVIEW",
    "REQUIRES_REVIEW",
    "SUCCESS",
    "REFUNDED",
  ]),
  REFUNDED: new Set(["REFUNDED"]),
  EXPIRED: new Set([
    "EXPIRED",
    "CANCELLED",
    "PENDING_REVIEW",
    "REQUIRES_REVIEW",
    "SUCCESS",
    "REFUNDED",
  ]),
};

export function isLegalAirwallexTransition(
  from: PaymentTransactionStatus,
  to: PaymentTransactionStatus,
): boolean {
  return LEGAL_TRANSITIONS[from].has(to);
}

export function isTerminalAirwallexStatus(
  status: PaymentTransactionStatus,
): boolean {
  return ["SUCCESS", "FAILED", "CANCELLED", "REFUNDED", "EXPIRED"].includes(
    status,
  );
}

export type PublicAirwallexPaymentStatus =
  | "CREATED"
  | "REQUIRES_PAYMENT_METHOD"
  | "PENDING"
  | "PENDING_REVIEW"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"
  | "REQUIRES_REVIEW";

export function toPublicAirwallexStatus(
  status: PaymentTransactionStatus,
): PublicAirwallexPaymentStatus {
  if (status === "SUCCESS") return "SUCCEEDED";
  if (status === "EXPIRED") return "CANCELLED";
  return status;
}

// ── Non-terminal statuses that warrant a live Airwallex API check ──────
const FALLBACK_ELIGIBLE_STATUSES = new Set<PaymentTransactionStatus>([
  "CREATED",
  "REQUIRES_PAYMENT_METHOD",
  "PENDING",
  "PROCESSING",
  "PENDING_REVIEW",
]);

/**
 * Attempt a live check against the Airwallex API for a payment that is still
 * in a non-terminal state. If Airwallex reports a terminal status (e.g.
 * SUCCEEDED), apply it to the database via the existing verification
 * pipeline so the order status is updated immediately.
 *
 * This is a **fallback** for situations where the webhook didn't arrive
 * (e.g. the Vercel deployment URL isn't configured in Airwallex yet, or
 * the webhook was delayed / lost). The polling status endpoint triggers
 * this automatically so the user isn't stuck on "Confirming your payment".
 *
 * Returns the updated public status, or the original if the API call fails
 * (the fallback must never break the polling endpoint).
 */
async function fallbackAirwallexStatusCheck(
  paymentIntentId: string,
  currentAttemptStatus: PaymentTransactionStatus,
): Promise<PublicAirwallexPaymentStatus> {
  try {
    const intent = await retrieveAirwallexPaymentIntent(paymentIntentId);
    const mappedStatus = mapAirwallexPaymentStatus(intent.status);

    // Only apply if the provider moved to a different (typically terminal)
    // state that our DB hasn't caught up with.
    if (
      mappedStatus !== currentAttemptStatus &&
      isLegalAirwallexTransition(currentAttemptStatus, mappedStatus)
    ) {
      const result = await applyAuthoritativeAirwallexPayment({
        authoritative: toAirwallexAuthoritativePayment(intent),
        source: "RECONCILIATION",
      });

      logAirwallexEvent({
        event: "FALLBACK_STATUS_APPLIED",
        paymentIntentId,
        fromStatus: currentAttemptStatus,
        toStatus: result.status,
      });

      return toPublicAirwallexStatus(result.status);
    }

    // Provider status unchanged — return the mapped version.
    return toPublicAirwallexStatus(mappedStatus);
  } catch (error) {
    // Fallback must never break the polling endpoint. Log and return the
    // current DB status so the frontend keeps polling normally.
    console.error("[airwallex.status] fallback check failed", {
      paymentIntentId,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return toPublicAirwallexStatus(currentAttemptStatus);
  }
}

export async function getOwnerScopedAirwallexPaymentStatus(
  customer: PaymentOrderCustomer,
  orderId: string,
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...paymentCustomerOrderWhere(customer), paymentMethod: "AIRWALLEX" },
    select: {
      id: true,
      paymentStatus: true,
      updatedAt: true,
      _count: {
        select: {
          payments: {
            where: {
              provider: AIRWALLEX_PROVIDER,
              requiresReview: true,
            },
          },
        },
      },
      payments: {
        where: { provider: AIRWALLEX_PROVIDER },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: {
          status: true,
          transactionId: true,
          requiresReview: true,
          failureMessage: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!order) return null;
  const attempt = order.payments[0];
  const hasReview = order._count.payments > 0;

  // ── Fast path: DB already has a terminal / review status ──────────
  if (order.paymentStatus === "PAID") {
    return buildStatusResponse(order, "SUCCEEDED", hasReview, attempt);
  }

  let derivedStatus: PublicAirwallexPaymentStatus = hasReview
    ? attempt?.status === "PENDING_REVIEW"
      ? "PENDING_REVIEW"
      : "REQUIRES_REVIEW"
    : attempt
      ? toPublicAirwallexStatus(attempt.status)
      : "CREATED";

  // ── Fallback: DB is non-terminal but Airwallex may have advanced ──
  // When the webhook is missing or delayed, poll the Airwallex API directly
  // and synchronise the DB so the frontend can proceed.
  if (
    !hasReview &&
    attempt?.transactionId &&
    FALLBACK_ELIGIBLE_STATUSES.has(attempt.status)
  ) {
    derivedStatus = await fallbackAirwallexStatusCheck(
      attempt.transactionId,
      attempt.status,
    );

    // If we just synced a terminal status, re-read the order to get the
    // updated paymentStatus and timestamps.
    if (["SUCCEEDED", "FAILED", "CANCELLED", "REFUNDED"].includes(derivedStatus)) {
      const refreshed = await prisma.order.findFirst({
        where: { id: orderId, ...paymentCustomerOrderWhere(customer) },
        select: {
          paymentStatus: true,
          updatedAt: true,
          payments: {
            where: { provider: AIRWALLEX_PROVIDER },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
            select: {
              status: true,
              requiresReview: true,
              failureMessage: true,
              updatedAt: true,
            },
          },
        },
      });
      if (refreshed) {
        const refreshedAttempt = refreshed.payments[0];
        const refreshedOrder = {
          id: order.id,
          paymentStatus: refreshed.paymentStatus,
          updatedAt: refreshed.updatedAt,
        };
        return buildStatusResponse(
          refreshedOrder,
          derivedStatus,
          hasReview,
          refreshedAttempt ?? attempt,
        );
      }
    }
  }

  return buildStatusResponse(order, derivedStatus, hasReview, attempt);
}

function buildStatusResponse(
  order: { id: string; updatedAt: Date },
  status: PublicAirwallexPaymentStatus,
  hasReview: boolean,
  attempt: {
    status: PaymentTransactionStatus;
    requiresReview: boolean;
    failureMessage: string | null;
    updatedAt: Date;
  } | undefined,
) {
  return {
    orderId: order.id,
    paymentStatus: status,
    provider: AIRWALLEX_PROVIDER,
    requiresReview: hasReview,
    failureMessage: hasReview
      ? "Payment verification requires manual review."
      : status === "FAILED"
        ? "The payment was not completed. You can try again safely."
        : null,
    updatedAt: (attempt?.updatedAt ?? order.updatedAt).toISOString(),
    terminal: ["SUCCEEDED", "FAILED", "CANCELLED", "REFUNDED"].includes(
      status,
    ),
  };
}
