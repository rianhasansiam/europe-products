import "server-only";

import type { PaymentTransactionStatus } from "@/app/generated/prisma/client";

import { requireAirwallexConfig } from "../config/airwallex.config";
import { AirwallexError } from "../errors/airwallex.errors";
import {
  recordAirwallexReconciliationResult,
  unresolvedAirwallexAttempts,
} from "../repositories/airwallex-payment.repository";
import { logAirwallexEvent } from "../security/airwallex-redaction";
import { retrieveAirwallexPaymentIntent } from "./airwallex-payment-intent.service";
import {
  processPendingAirwallexWebhookEvents,
  type AirwallexEventProcessingSummary,
} from "./airwallex-payment-event.service";
import {
  applyAuthoritativeAirwallexPayment,
  toAirwallexAuthoritativePayment,
} from "./airwallex-payment-verification.service";

const DEFAULT_PAYMENT_BATCH_SIZE = 10;
const DEFAULT_PROVIDER_CONCURRENCY = 3;

type ReconciliationOutcome = {
  ok: boolean;
  status?: PaymentTransactionStatus;
  requiresReview?: boolean;
};

export type AirwallexReconciliationSummary = {
  events: AirwallexEventProcessingSummary;
  payments: {
    examined: number;
    reconciled: number;
    confirmed: number;
    terminalized: number;
    stillPending: number;
    requiresReview: number;
    errors: number;
  };
};

function reconciliationErrorCode(error: unknown): string {
  return error instanceof AirwallexError
    ? error.code
    : "AIRWALLEX_RECONCILIATION_ERROR";
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
): Promise<R[]> {
  if (values.length === 0) return [];
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(values[index]!);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(concurrency, 1), values.length) },
      () => runWorker(),
    ),
  );
  return results;
}

/**
 * Drain durable webhook events first, then retrieve unresolved intents and
 * send both sources through the same authoritative transition service.
 */
export async function reconcileAirwallexPayments(): Promise<AirwallexReconciliationSummary> {
  requireAirwallexConfig();

  const events = await processPendingAirwallexWebhookEvents();
  const candidates = await unresolvedAirwallexAttempts(
    DEFAULT_PAYMENT_BATCH_SIZE,
  );
  const outcomes = await mapWithConcurrency(
    candidates,
    DEFAULT_PROVIDER_CONCURRENCY,
    async (candidate): Promise<ReconciliationOutcome> => {
      const startedAt = Date.now();
      const paymentIntentId = candidate.transactionId;
      if (!paymentIntentId) {
        return { ok: false };
      }

      try {
        const intent = await retrieveAirwallexPaymentIntent(paymentIntentId);
        const result = await applyAuthoritativeAirwallexPayment({
          authoritative: toAirwallexAuthoritativePayment(intent),
          source: "RECONCILIATION",
        });
        logAirwallexEvent({
          event: "RECONCILIATION_PROCESSED",
          orderId: result.orderId,
          paymentAttemptId: result.paymentId,
          paymentIntentId,
          toStatus: result.status,
          durationMs: Date.now() - startedAt,
          requiresReview: result.requiresReview,
        });
        return {
          ok: true,
          status: result.status,
          requiresReview: result.requiresReview,
        };
      } catch (error) {
        const errorCode = reconciliationErrorCode(error);
        try {
          await recordAirwallexReconciliationResult({
            paymentId: candidate.id,
            result: `ERROR:${errorCode}`,
          });
        } catch {
          logAirwallexEvent({
            event: "RECONCILIATION_STATE_PERSIST_FAILED",
            orderId: candidate.orderId,
            paymentAttemptId: candidate.id,
            paymentIntentId,
            errorCode: "AIRWALLEX_PERSISTENCE_ERROR",
          });
        }
        logAirwallexEvent({
          event: "RECONCILIATION_FAILED",
          orderId: candidate.orderId,
          paymentAttemptId: candidate.id,
          paymentIntentId,
          durationMs: Date.now() - startedAt,
          errorCode,
        });
        return { ok: false };
      }
    },
  );

  const reconciled = outcomes.filter(
    (outcome): outcome is ReconciliationOutcome & { ok: true } => outcome.ok,
  );
  const nonSuccessTerminalStatuses = new Set<PaymentTransactionStatus>([
    "FAILED",
    "CANCELLED",
    "REFUNDED",
    "EXPIRED",
  ]);
  const pendingStatuses = new Set<PaymentTransactionStatus>([
    "CREATED",
    "REQUIRES_PAYMENT_METHOD",
    "PENDING",
    "PROCESSING",
  ]);

  return {
    events,
    payments: {
      examined: candidates.length,
      reconciled: reconciled.length,
      confirmed: reconciled.filter((outcome) => outcome.status === "SUCCESS")
        .length,
      terminalized: reconciled.filter(
        (outcome) =>
          outcome.status !== undefined &&
          nonSuccessTerminalStatuses.has(outcome.status),
      ).length,
      stillPending: reconciled.filter(
        (outcome) =>
          outcome.status !== undefined && pendingStatuses.has(outcome.status),
      ).length,
      requiresReview: reconciled.filter(
        (outcome) =>
          outcome.requiresReview || outcome.status === "REQUIRES_REVIEW",
      ).length,
      errors: outcomes.length - reconciled.length,
    },
  };
}
