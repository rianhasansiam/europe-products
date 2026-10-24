import "server-only";

import {
  Prisma,
  type PaymentTransactionStatus,
} from "@/app/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";
import { parseHistoricalCurrencyCode } from "@/lib/currency/config";
import { sumDecimals, toDecimal } from "@/lib/money";
import {
  lockOrderForStatusChange,
  lockPaymentAttempt,
  recordStatusHistory,
} from "@/lib/orders/mutations";

import {
  AIRWALLEX_PAYMENT_ATTEMPT_FAILURE_EVENT_NAMES,
  AIRWALLEX_PAYMENT_INTENT_EVENT_NAMES,
  AIRWALLEX_PROVIDER,
} from "../constants/airwallex.constants";
import { AirwallexValidationError } from "../errors/airwallex.errors";
import {
  appendAirwallexTransition,
  markAirwallexEventProcessed,
} from "../repositories/airwallex-payment.repository";
import {
  logAirwallexEvent,
  sanitizeAirwallexCode,
} from "../security/airwallex-redaction";
import {
  isLegalAirwallexTransition,
  mapAirwallexPaymentStatus,
} from "./airwallex-payment-status.service";
import {
  safeAirwallexReviewMessage,
  type AirwallexReviewReason,
} from "./airwallex-risk.service";
import type { AirwallexPaymentIntentRetrieveResponse } from "../types/airwallex.types";
import { findAirwallexPaymentQuoteMismatch } from "./airwallex-currency.service";

export type AirwallexAuthoritativePayment = {
  paymentIntentId: string;
  /** Informational only: Airwallex changes it for each lifecycle operation. */
  requestId: string;
  merchantOrderId: string;
  amount: number | string;
  currency: string;
  providerStatus: string;
  failureCode?: string | null;
  failureMessage?: string | null;
};

export type AirwallexTransitionSource =
  | "INITIATION"
  | "WEBHOOK"
  | "RECONCILIATION";

export type AirwallexProviderEventLease = {
  recordId: string;
  eventId: string;
  eventName: string;
  lockToken: string;
};

const KNOWN_WEBHOOK_EVENTS = new Set<string>([
  ...AIRWALLEX_PAYMENT_INTENT_EVENT_NAMES,
  ...AIRWALLEX_PAYMENT_ATTEMPT_FAILURE_EVENT_NAMES,
]);

/** Convert a validated provider response into the single verification shape. */
export function toAirwallexAuthoritativePayment(
  intent: AirwallexPaymentIntentRetrieveResponse,
): AirwallexAuthoritativePayment {
  return {
    paymentIntentId: intent.id,
    requestId: intent.request_id,
    merchantOrderId: intent.merchant_order_id,
    amount: intent.amount,
    currency: intent.currency,
    providerStatus: intent.status,
    failureCode: intent.latest_payment_attempt?.failure_code ?? null,
    // Provider prose is deliberately discarded; it is neither needed for
    // state verification nor safe enough to persist or expose.
    failureMessage: null,
  };
}

export type PersistedOrderSnapshot = {
  id: string;
  subtotal: Prisma.Decimal;
  deliveryCharge: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  currency: string;
  baseCurrency: string;
  displayCurrency: string;
  promoCode: string | null;
  promoCodeUsages: readonly { id: string }[];
  items: readonly {
    quantity: number;
    unitPrice: Prisma.Decimal;
    totalPrice: Prisma.Decimal;
  }[];
};

export function amountMatchesAirwallex(
  internalAmount: Prisma.Decimal,
  providerAmount: number | string,
): boolean {
  try {
    return toDecimal(internalAmount).equals(toDecimal(String(providerAmount)));
  } catch {
    return false;
  }
}

/** Recalculate the immutable checkout snapshot with exact Decimal arithmetic. */
export function verifyPersistedAirwallexOrderSnapshot(
  order: PersistedOrderSnapshot,
): AirwallexReviewReason | null {
  if (order.items.length === 0) return "ORDER_TOTAL_MISMATCH";
  for (const item of order.items) {
    if (
      item.quantity <= 0 ||
      !toDecimal(item.unitPrice)
        .times(item.quantity)
        .equals(toDecimal(item.totalPrice))
    ) {
      return "ORDER_TOTAL_MISMATCH";
    }
  }
  const calculatedSubtotal = sumDecimals(
    order.items.map((item) => item.totalPrice),
  );
  if (!calculatedSubtotal.equals(order.subtotal)) {
    return "ORDER_TOTAL_MISMATCH";
  }
  if (
    toDecimal(order.discountAmount).isNegative() ||
    toDecimal(order.discountAmount).greaterThan(order.subtotal) ||
    toDecimal(order.deliveryCharge).isNegative() ||
    toDecimal(order.taxAmount).isNegative()
  ) {
    return "ORDER_TOTAL_MISMATCH";
  }
  const calculatedTotal = calculatedSubtotal
    .minus(order.discountAmount)
    .plus(order.deliveryCharge)
    .plus(order.taxAmount);
  if (!calculatedTotal.equals(order.totalAmount)) {
    return "ORDER_TOTAL_MISMATCH";
  }
  if (order.promoCode && order.promoCodeUsages.length === 0) {
    return "ORDER_TOTAL_MISMATCH";
  }
  if (
    !parseHistoricalCurrencyCode(order.baseCurrency.trim().toUpperCase()) ||
    order.currency.trim().toUpperCase() !== order.baseCurrency.trim().toUpperCase() ||
    !parseHistoricalCurrencyCode(order.displayCurrency.trim().toUpperCase())
  ) {
    return "CURRENCY_MISMATCH";
  }
  return null;
}

export function findAirwallexVerificationMismatch(
  payment: {
    transactionId: string | null;
    amount: Prisma.Decimal;
    currency: string;
    baseAmount: Prisma.Decimal | null;
    baseCurrency: string | null;
    exchangeRate: Prisma.Decimal | null;
    exchangeRateAt: Date | null;
    order: PersistedOrderSnapshot;
  },
  authoritative: AirwallexAuthoritativePayment,
): AirwallexReviewReason | null {
  if (payment.transactionId !== authoritative.paymentIntentId) {
    return "PAYMENT_INTENT_MISMATCH";
  }
  // Airwallex request_id identifies the most recent operation (create,
  // confirm, cancel, etc.), so it is not a lifecycle-stable correlation key.
  // The original create request ID is checked once when create returns; all
  // later states bind through PaymentIntent ID + merchant order + money.
  if (payment.order.id !== authoritative.merchantOrderId) {
    return "ORDER_ID_MISMATCH";
  }
  const orderMismatch = verifyPersistedAirwallexOrderSnapshot(payment.order);
  if (orderMismatch) return orderMismatch;

  // The payment transaction amount must match what Airwallex reports (both
  // are in the settlement currency, e.g. USD).
  if (!amountMatchesAirwallex(payment.amount, authoritative.amount)) {
    return "AMOUNT_MISMATCH";
  }

  const paymentCurrency = payment.currency.toUpperCase();
  const providerCurrency = authoritative.currency.toUpperCase();
  if (paymentCurrency !== providerCurrency) {
    // Payment record and Airwallex must always agree on currency.
    return "CURRENCY_MISMATCH";
  }

  if (
    payment.baseAmount == null ||
    payment.baseCurrency == null ||
    payment.exchangeRate == null ||
    payment.exchangeRateAt == null
  ) {
    return "PAYMENT_QUOTE_MISMATCH";
  }
  return findAirwallexPaymentQuoteMismatch({
    canonicalBaseAmount: payment.order.totalAmount,
    displayCurrency: payment.order.displayCurrency,
    baseAmount: payment.baseAmount,
    baseCurrency: payment.baseCurrency,
    paymentAmount: payment.amount,
    paymentCurrency: payment.currency,
    exchangeRate: payment.exchangeRate,
    exchangeRateAt: payment.exchangeRateAt,
  });
}

export type ApplyAirwallexPaymentResult = {
  orderId: string;
  paymentId: string;
  status: PaymentTransactionStatus;
  duplicate: boolean;
  requiresReview: boolean;
};

export async function applyAuthoritativeAirwallexPayment(input: {
  authoritative: AirwallexAuthoritativePayment;
  source: AirwallexTransitionSource;
  providerEvent?: AirwallexProviderEventLease;
}): Promise<ApplyAirwallexPaymentResult> {
  const candidate = await prisma.paymentTransaction.findUnique({
    where: {
      provider_transactionId: {
        provider: AIRWALLEX_PROVIDER,
        transactionId: input.authoritative.paymentIntentId,
      },
    },
    select: { id: true, orderId: true },
  });
  if (!candidate) {
    throw new AirwallexValidationError("Payment attempt was not found.");
  }

  return prisma.$transaction(async (tx) => {
    await lockOrderForStatusChange(tx, candidate.orderId);
    await lockPaymentAttempt(tx, candidate.id);

    const payment = await tx.paymentTransaction.findUnique({
      where: { id: candidate.id },
      include: {
        order: {
          include: {
            items: {
              select: {
                quantity: true,
                unitPrice: true,
                totalPrice: true,
              },
            },
            promoCodeUsages: { select: { id: true }, take: 1 },
          },
        },
      },
    });
    if (!payment || payment.provider !== AIRWALLEX_PROVIDER) {
      throw new AirwallexValidationError("Payment attempt was not found.");
    }

    const targetStatus = mapAirwallexPaymentStatus(
      input.authoritative.providerStatus,
    );
    let reviewReason = findAirwallexVerificationMismatch(
      payment,
      input.authoritative,
    );
    if (!reviewReason && targetStatus === "REQUIRES_REVIEW") {
      reviewReason = "UNKNOWN_PROVIDER_STATUS";
    }
    if (
      !reviewReason &&
      input.providerEvent &&
      !KNOWN_WEBHOOK_EVENTS.has(input.providerEvent.eventName)
    ) {
      reviewReason = "UNKNOWN_PROVIDER_EVENT";
    }
    if (
      !reviewReason &&
      targetStatus === "SUCCESS" &&
      !["PENDING", "PAYMENT_CONFIRMED"].includes(payment.order.status)
    ) {
      reviewReason = "ORDER_NOT_ELIGIBLE";
    }
    if (
      !reviewReason &&
      targetStatus === "SUCCESS" &&
      payment.order.paymentStatus === "PAID" &&
      payment.status !== "SUCCESS"
    ) {
      reviewReason = "MULTIPLE_SUCCESSFUL_PAYMENTS";
    }
    if (
      !reviewReason &&
      payment.status !== "SUCCESS" &&
      payment.status !== "REFUNDED" &&
      !(
        ["FAILED", "CANCELLED", "EXPIRED"].includes(payment.status) &&
        ![
          "CANCELLED",
          "PENDING_REVIEW",
          "SUCCESS",
          "REFUNDED",
          "REQUIRES_REVIEW",
        ].includes(targetStatus)
      ) &&
      !isLegalAirwallexTransition(payment.status, targetStatus)
    ) {
      reviewReason = "ILLEGAL_STATE_TRANSITION";
    }

    // A confirmed success is monotonic. Authentic late failures/pending events
    // are acknowledged but never downgrade the payment or order.
    const monotonicDuplicate =
      (payment.status === "SUCCESS" && targetStatus !== "REFUNDED") ||
      payment.status === "REFUNDED" ||
      (["FAILED", "CANCELLED", "EXPIRED"].includes(payment.status) &&
        ![
          "CANCELLED",
          "PENDING_REVIEW",
          "SUCCESS",
          "REFUNDED",
          "REQUIRES_REVIEW",
        ].includes(targetStatus));
    const effectiveStatus = monotonicDuplicate
      ? payment.status
      : reviewReason
        ? payment.status === "SUCCESS"
          ? "SUCCESS"
          : "REQUIRES_REVIEW"
        : targetStatus;
    const requiresReview = Boolean(reviewReason) || effectiveStatus === "PENDING_REVIEW";
    const safeFailureCode = sanitizeAirwallexCode(
      input.authoritative.failureCode,
    );

    if (!monotonicDuplicate || reviewReason) {
      await tx.paymentTransaction.update({
        where: { id: payment.id },
        data: {
          status: effectiveStatus,
          providerStatus: input.authoritative.providerStatus,
          failureCode: safeFailureCode,
          failureMessage:
            reviewReason != null
              ? safeAirwallexReviewMessage(reviewReason)
              : null,
          requiresReview,
          reviewReason: reviewReason ?? (requiresReview ? "PENDING_REVIEW" : null),
          ...(effectiveStatus === "SUCCESS" && !reviewReason
            ? { paidAt: payment.paidAt ?? new Date() }
            : {}),
          ...(input.source === "RECONCILIATION"
            ? {
                lastReconciledAt: new Date(),
                reconciliationResult: effectiveStatus,
                reconciliationAttempts: { increment: 1 },
              }
            : {}),
        },
      });
    }

    if (effectiveStatus === "SUCCESS" && !reviewReason) {
      const otherSuccess = await tx.paymentTransaction.findFirst({
        where: {
          orderId: payment.orderId,
          id: { not: payment.id },
          status: "SUCCESS",
        },
        select: { id: true },
      });
      if (otherSuccess) {
        await tx.paymentTransaction.update({
          where: { id: payment.id },
          data: {
            requiresReview: true,
            reviewReason: "MULTIPLE_SUCCESSFUL_PAYMENTS",
            failureMessage: safeAirwallexReviewMessage(
              "MULTIPLE_SUCCESSFUL_PAYMENTS",
            ),
          },
        });
        reviewReason = "MULTIPLE_SUCCESSFUL_PAYMENTS";
      } else if (payment.order.paymentStatus !== "PAID") {
        const nextOrderStatus =
          payment.order.status === "PENDING"
            ? "PAYMENT_CONFIRMED"
            : payment.order.status;
        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            paymentStatus: "PAID",
            status: nextOrderStatus,
          },
        });
        if (nextOrderStatus !== payment.order.status) {
          await recordStatusHistory(tx, payment.orderId, nextOrderStatus, {
            note: "Airwallex payment confirmed by verified provider data.",
          });
        }
      }
    } else if (
      !reviewReason &&
      ["FAILED", "CANCELLED"].includes(effectiveStatus) &&
      payment.order.paymentStatus !== "PAID"
    ) {
      const otherOpenAttempt = await tx.paymentTransaction.findFirst({
        where: {
          orderId: payment.orderId,
          id: { not: payment.id },
          provider: AIRWALLEX_PROVIDER,
          status: {
            in: [
              "CREATED",
              "REQUIRES_PAYMENT_METHOD",
              "PENDING",
              "PROCESSING",
              "PENDING_REVIEW",
              "REQUIRES_REVIEW",
            ],
          },
        },
        select: { id: true },
      });
      if (!otherOpenAttempt) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { paymentStatus: "FAILED" },
        });
      }
    } else if (
      !reviewReason &&
      [
        "CREATED",
        "REQUIRES_PAYMENT_METHOD",
        "PENDING",
        "PROCESSING",
        "PENDING_REVIEW",
      ].includes(effectiveStatus) &&
      payment.order.paymentStatus !== "PAID"
    ) {
      await tx.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus: "PENDING" },
      });
    }

    await appendAirwallexTransition(tx, {
      paymentTransactionId: payment.id,
      source: input.source,
      eventName:
        input.providerEvent?.eventName ??
        (input.source === "INITIATION"
          ? "airwallex.initiation.observed"
          : "airwallex.reconciliation.observed"),
      fromStatus: payment.status,
      toStatus: effectiveStatus,
      providerStatus: input.authoritative.providerStatus,
      providerEventId: input.providerEvent?.eventId,
      reasonCode: reviewReason,
      requiresReview: Boolean(reviewReason) || requiresReview,
    });

    if (input.providerEvent) {
      const marked = await markAirwallexEventProcessed(tx, {
        id: input.providerEvent.recordId,
        lockToken: input.providerEvent.lockToken,
        paymentTransactionId: payment.id,
        requiresReview: Boolean(reviewReason),
        processingError: reviewReason,
      });
      if (marked.count !== 1) {
        throw new AirwallexValidationError(
          "Payment notification lease is no longer valid.",
        );
      }
    }

    logAirwallexEvent({
      event: "PAYMENT_STATE_APPLIED",
      orderId: payment.orderId,
      paymentAttemptId: payment.id,
      paymentIntentId: input.authoritative.paymentIntentId,
      providerEventId: input.providerEvent?.eventId,
      eventName: input.providerEvent?.eventName,
      fromStatus: payment.status,
      toStatus: effectiveStatus,
      errorCode: reviewReason,
      requiresReview: Boolean(reviewReason) || requiresReview,
    });

    return {
      orderId: payment.orderId,
      paymentId: payment.id,
      status: effectiveStatus,
      duplicate: monotonicDuplicate || payment.status === effectiveStatus,
      requiresReview: Boolean(reviewReason) || requiresReview,
    };
  });
}
