import "server-only";

import { BASE_CURRENCY } from "@/lib/currency/config";

import {
  Prisma,
  type PaymentTransactionStatus,
} from "@/app/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";
import { toDecimal } from "@/lib/money";
import {
  paymentCustomerOrderWhere,
  type PaymentOrderCustomer,
} from "@/lib/payments/core/payment-order-customer";
import {
  lockOrderForStatusChange,
  lockPaymentAttempt,
} from "@/lib/orders/mutations";

import {
  buildAirwallexReturnUrls,
  requireAirwallexConfig,
} from "../config/airwallex.config";
import { AIRWALLEX_CLIENT_SECRET_LIFETIME_MS, AIRWALLEX_CREATE_REQUESTED_STATUS } from "../constants/airwallex.constants";
import {
  AirwallexApiError,
  AirwallexError,
  AirwallexPaymentAlreadyProcessedError,
  AirwallexStateTransitionError,
  AirwallexValidationError,
} from "../errors/airwallex.errors";
import {
  airwallexInitiationOrderInclude,
  appendAirwallexTransition,
  createAirwallexAttempt,
  findOwnerScopedAirwallexOrder,
} from "../repositories/airwallex-payment.repository";
import {
  logAirwallexEvent,
  sanitizeAirwallexCode,
} from "../security/airwallex-redaction";
import { createAirwallexRequestId } from "../security/airwallex-idempotency";
import type {
  AirwallexHostedPaymentPageConfig,
  AirwallexPaymentIntentRetrieveResponse,
} from "../types/airwallex.types";
import {
  cancelAirwallexPaymentIntent,
  createAirwallexPaymentIntent,
  retrieveAirwallexPaymentIntent,
} from "./airwallex-payment-intent.service";
import {
  isLegalAirwallexTransition,
  mapAirwallexPaymentStatus,
} from "./airwallex-payment-status.service";
import {
  amountMatchesAirwallex,
  applyAuthoritativeAirwallexPayment,
  toAirwallexAuthoritativePayment,
  verifyPersistedAirwallexOrderSnapshot,
} from "./airwallex-payment-verification.service";
import {
  safeAirwallexReviewMessage,
  type AirwallexReviewReason,
} from "./airwallex-risk.service";
import {
  findAirwallexPaymentQuoteMismatch,
  resolveAirwallexPaymentCurrency,
} from "./airwallex-currency.service";

const CLIENT_SECRET_REFRESH_SKEW_MS = 5 * 60_000;
const REDIRECTABLE_PROVIDER_STATUSES = new Set([
  "REQUIRES_PAYMENT_METHOD",
  "REQUIRES_CUSTOMER_ACTION",
]);
const CANCELLABLE_PROVIDER_STATUSES = new Set([
  "REQUIRES_PAYMENT_METHOD",
  "REQUIRES_CUSTOMER_ACTION",
]);
const AMBIGUOUS_CREATE_REJECTION_STATUSES = new Set([408, 409, 425, 429]);

type PreparedAttempt = {
  orderId: string;
  attemptId: string;
  requestId: string;
  baseAmount: string;
  baseCurrency: string;
  displayCurrency: string;
  paymentAmount: string;
  paymentCurrency: string;
  exchangeRate: string;
  exchangeRateAt: string;
  paymentIntentId: string | null;
  status: PaymentTransactionStatus;
};

type PrepareResult =
  | { ok: true; value: PreparedAttempt }
  | { ok: false; reason: "REVIEW" };

function orderNotFound(): AirwallexError {
  return new AirwallexError({
    code: "AIRWALLEX_VALIDATION_ERROR",
    status: 404,
    message: "Order was not found.",
  });
}

function sanitizedIntent(
  intent: AirwallexPaymentIntentRetrieveResponse,
): Prisma.InputJsonValue {
  const attempt = intent.latest_payment_attempt;
  return {
    id: intent.id,
    request_id: intent.request_id,
    merchant_order_id: intent.merchant_order_id,
    amount: String(intent.amount),
    currency: intent.currency,
    status: intent.status,
    created_at: intent.created_at,
    updated_at: intent.updated_at,
    ...(intent.cancelled_at ? { cancelled_at: intent.cancelled_at } : {}),
    ...(attempt
      ? {
          latest_payment_attempt: {
            id: attempt.id,
            status: attempt.status,
            ...(attempt.failure_code
              ? { failure_code: sanitizeAirwallexCode(attempt.failure_code) }
              : {}),
          },
        }
      : {}),
  };
}

function isClientSecretFresh(createdAt: string, now = Date.now()): boolean {
  const created = Date.parse(createdAt);
  return (
    Number.isFinite(created) &&
    now - created <
      AIRWALLEX_CLIENT_SECRET_LIFETIME_MS - CLIENT_SECRET_REFRESH_SKEW_MS
  );
}

async function quarantineAttempt(
  tx: Prisma.TransactionClient,
  input: {
    attemptId: string;
    fromStatus: PaymentTransactionStatus;
    providerStatus: string;
    paymentIntentId?: string;
    reason: AirwallexReviewReason;
    rawResponse?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await tx.paymentTransaction.update({
    where: { id: input.attemptId },
    data: {
      ...(input.paymentIntentId
        ? { transactionId: input.paymentIntentId }
        : {}),
      status: "REQUIRES_REVIEW",
      providerStatus: input.providerStatus,
      requiresReview: true,
      reviewReason: input.reason,
      failureMessage: safeAirwallexReviewMessage(input.reason),
      ...(input.rawResponse ? { rawResponse: input.rawResponse } : {}),
    },
  });
  await appendAirwallexTransition(tx, {
    paymentTransactionId: input.attemptId,
    source: "INITIATION",
    eventName: "airwallex.initiation.quarantined",
    fromStatus: input.fromStatus,
    toStatus: "REQUIRES_REVIEW",
    providerStatus: input.providerStatus,
    reasonCode: input.reason,
    requiresReview: true,
  });
}

function isDefinitiveCreateRejection(
  error: unknown,
): error is AirwallexApiError & { providerStatus: number } {
  if (!(error instanceof AirwallexApiError)) return false;
  const status = error.providerStatus;
  return (
    status !== null &&
    status >= 400 &&
    status < 500 &&
    !error.retryable &&
    !AMBIGUOUS_CREATE_REJECTION_STATUSES.has(status)
  );
}

async function recordDefinitiveCreateRejection(
  prepared: PreparedAttempt,
  error: AirwallexApiError & { providerStatus: number },
): Promise<void> {
  const providerStatus = `CREATE_REJECTED_${error.providerStatus}`;
  const providerCode = sanitizeAirwallexCode(error.details?.providerCode);

  await prisma.$transaction(async (tx) => {
    await lockOrderForStatusChange(tx, prepared.orderId);
    await lockPaymentAttempt(tx, prepared.attemptId);
    const attempt = await tx.paymentTransaction.findUnique({
      where: { id: prepared.attemptId },
      select: {
        orderId: true,
        idempotencyKey: true,
        transactionId: true,
        status: true,
      },
    });
    if (
      !attempt ||
      attempt.orderId !== prepared.orderId ||
      attempt.idempotencyKey !== prepared.requestId ||
      attempt.transactionId !== null ||
      attempt.status !== "CREATED"
    ) {
      return;
    }

    const updated = await tx.paymentTransaction.updateMany({
      where: {
        id: prepared.attemptId,
        transactionId: null,
        status: "CREATED",
      },
      data: {
        status: "FAILED",
        providerStatus,
        failureCode: providerCode ?? "CREATE_REJECTED",
        failureMessage: null,
        requiresReview: false,
        reviewReason: null,
      },
    });
    if (updated.count !== 1) return;

    await appendAirwallexTransition(tx, {
      paymentTransactionId: prepared.attemptId,
      source: "INITIATION",
      eventName: "payment_intent.create_rejected",
      fromStatus: "CREATED",
      toStatus: "FAILED",
      providerStatus,
      reasonCode: providerCode ?? "CREATE_REJECTED",
      requiresReview: false,
    });
    await tx.order.updateMany({
      where: {
        id: prepared.orderId,
        paymentStatus: { not: "PAID" },
      },
      data: { paymentStatus: "FAILED" },
    });
  });

  logAirwallexEvent({
    event: "PAYMENT_INTENT_CREATE_REJECTED",
    orderId: prepared.orderId,
    paymentAttemptId: prepared.attemptId,
    baseCurrency: prepared.baseCurrency,
    displayCurrency: prepared.displayCurrency,
    paymentCurrency: prepared.paymentCurrency,
    baseAmount: prepared.baseAmount,
    paymentAmount: prepared.paymentAmount,
    exchangeRate: prepared.exchangeRate,
    exchangeRateAt: prepared.exchangeRateAt,
    toStatus: "FAILED",
    errorCode: providerCode ?? providerStatus,
  });
}

async function prepareAttempt(
  customer: PaymentOrderCustomer,
  orderId: string,
): Promise<PrepareResult> {
  return prisma.$transaction(async (tx) => {
    await lockOrderForStatusChange(tx, orderId);
    const order = await findOwnerScopedAirwallexOrder(tx, orderId, customer);
    if (!order) throw orderNotFound();
    if (order.paymentMethod !== "AIRWALLEX") {
      throw new AirwallexValidationError(
        "This order is not configured for Airwallex payment.",
      );
    }
    if (order.paymentStatus === "PAID") {
      throw new AirwallexPaymentAlreadyProcessedError();
    }
    if (order.status !== "PENDING") {
      throw new AirwallexStateTransitionError();
    }

    // Historical orders remain readable and reconcilable, but the USD rollout
    // must never initiate or retry a new charge from a legacy currency snapshot.
    if ([order.currency, order.baseCurrency, order.displayCurrency].some((currency) => currency !== BASE_CURRENCY)) {
      throw new AirwallexValidationError("This historical order cannot start a new payment. Contact support.");
    }
    const expectedPaymentCurrency = resolveAirwallexPaymentCurrency(
      order.displayCurrency,
    );
    const latest = order.payments[0];

    // The order and persisted payment quote are the only money authorities.
    if (order.payments.some((payment) => payment.status === "SUCCESS")) {
      throw new AirwallexPaymentAlreadyProcessedError();
    }
    // A quarantined quote in another currency can be a legacy-policy row;
    // only review in the currently expected payment currency blocks retry.
    if (
      order.payments.some(
        (payment) =>
          (payment.requiresReview || payment.status === "REQUIRES_REVIEW") &&
          payment.currency.toUpperCase() === expectedPaymentCurrency,
      )
    ) {
      return { ok: false, reason: "REVIEW" };
    }
    const snapshotMismatch = verifyPersistedAirwallexOrderSnapshot(order);
    if (snapshotMismatch) {
      if (latest) {
        await lockPaymentAttempt(tx, latest.id);
        await quarantineAttempt(tx, {
          attemptId: latest.id,
          fromStatus: latest.status,
          providerStatus: latest.providerStatus ?? "LOCAL_VALIDATION_FAILED",
          reason: snapshotMismatch,
        });
      }
      return { ok: false, reason: "REVIEW" };
    }

    if (!latest) {
      // Airwallex orders are reserved with their frozen attempt atomically.
      // Missing state is an integrity failure, not a reason to reprice.
      throw new AirwallexStateTransitionError();
    }

    const quoteFieldsMissing =
      latest.baseAmount == null ||
      latest.baseCurrency == null ||
      latest.exchangeRate == null ||
      latest.exchangeRateAt == null;
    const quoteMismatch = quoteFieldsMissing
      ? "PAYMENT_QUOTE_MISMATCH"
      : findAirwallexPaymentQuoteMismatch({
          canonicalBaseAmount: order.totalAmount,
          displayCurrency: order.displayCurrency,
          baseAmount: latest.baseAmount,
          baseCurrency: latest.baseCurrency,
          paymentAmount: latest.amount,
          paymentCurrency: latest.currency,
          exchangeRate: latest.exchangeRate,
          exchangeRateAt: latest.exchangeRateAt,
        });
    if (quoteMismatch) {
      await lockPaymentAttempt(tx, latest.id);
      await quarantineAttempt(tx, {
        attemptId: latest.id,
        fromStatus: latest.status,
        providerStatus: latest.providerStatus ?? "LOCAL_VALIDATION_FAILED",
        reason: quoteMismatch,
      });
      return { ok: false, reason: "REVIEW" };
    }

    let attempt: (typeof order.payments)[number] | undefined = latest;
    if (attempt?.status === "SUCCESS") {
      throw new AirwallexPaymentAlreadyProcessedError();
    }
    if (attempt?.status === "REFUNDED") {
      throw new AirwallexPaymentAlreadyProcessedError();
    }
    if (
      attempt &&
      ["FAILED", "CANCELLED", "EXPIRED"].includes(attempt.status) &&
      (!attempt.transactionId || attempt.status === "CANCELLED")
    ) {
      attempt = undefined;
    }

    // A new provider request identity copies the original frozen quote. It
    // must not consult today's FX table and silently change the charge.
    if (!attempt) {
      attempt = await createAirwallexAttempt(tx, {
        orderId: order.id,
        requestId: createAirwallexRequestId(),
        amount: latest.amount,
        currency: latest.currency,
        baseAmount: latest.baseAmount!,
        baseCurrency: latest.baseCurrency!,
        exchangeRate: latest.exchangeRate!,
        exchangeRateAt: latest.exchangeRateAt!,
      });
      if (order.paymentStatus !== "PENDING") {
        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: "PENDING" },
        });
      }
    }

    if (
      !attempt.idempotencyKey ||
      attempt.baseAmount == null ||
      attempt.baseCurrency == null ||
      attempt.exchangeRate == null ||
      attempt.exchangeRateAt == null
    ) {
      await lockPaymentAttempt(tx, attempt.id);
      await quarantineAttempt(tx, {
        attemptId: attempt.id,
        fromStatus: attempt.status,
        providerStatus: attempt.providerStatus ?? "LOCAL_VALIDATION_FAILED",
        reason: "PAYMENT_QUOTE_MISMATCH",
      });
      return { ok: false, reason: "REVIEW" };
    }

    if (!attempt.transactionId) {
      // Commit the request boundary while holding the same order lock used by
      // cancellation, before any provider HTTP call can begin. A timeout keeps
      // this marker: an unbound request can still exist at Airwallex.
      await lockPaymentAttempt(tx, attempt.id);
      await tx.paymentTransaction.update({
        where: { id: attempt.id },
        data: { providerStatus: AIRWALLEX_CREATE_REQUESTED_STATUS },
      });
    }

    return {
      ok: true,
      value: {
        orderId: order.id,
        attemptId: attempt.id,
        requestId: attempt.idempotencyKey,
        baseAmount: toDecimal(attempt.baseAmount).toFixed(2),
        baseCurrency: attempt.baseCurrency.trim().toUpperCase(),
        displayCurrency: order.displayCurrency.trim().toUpperCase(),
        paymentAmount: toDecimal(attempt.amount).toFixed(2),
        paymentCurrency: attempt.currency.trim().toUpperCase(),
        exchangeRate: toDecimal(attempt.exchangeRate).toString(),
        exchangeRateAt: attempt.exchangeRateAt.toISOString(),
        paymentIntentId: attempt.transactionId,
        status: attempt.status,
      },
    };
  });
}

function creationMismatch(
  prepared: PreparedAttempt,
  intent: AirwallexPaymentIntentRetrieveResponse,
): AirwallexReviewReason | null {
  if (intent.request_id !== prepared.requestId) return "REQUEST_ID_MISMATCH";
  if (intent.merchant_order_id !== prepared.orderId) return "ORDER_ID_MISMATCH";
  if (
    !amountMatchesAirwallex(toDecimal(prepared.paymentAmount), intent.amount)
  ) {
    return "AMOUNT_MISMATCH";
  }
  if (intent.currency.toUpperCase() !== prepared.paymentCurrency) {
    return "CURRENCY_MISMATCH";
  }
  if (mapAirwallexPaymentStatus(intent.status) === "REQUIRES_REVIEW") {
    return "UNKNOWN_PROVIDER_STATUS";
  }
  return null;
}

async function persistCreatedIntent(
  customer: PaymentOrderCustomer,
  prepared: PreparedAttempt,
  intent: AirwallexPaymentIntentRetrieveResponse,
): Promise<{ status: PaymentTransactionStatus; requiresReview: boolean }> {
  return prisma.$transaction(async (tx) => {
    await lockOrderForStatusChange(tx, prepared.orderId);
    await lockPaymentAttempt(tx, prepared.attemptId);
    const order = await tx.order.findFirst({
      where: { id: prepared.orderId, ...paymentCustomerOrderWhere(customer) },
      include: airwallexInitiationOrderInclude,
    });
    const attempt = order?.payments.find(
      (candidate) => candidate.id === prepared.attemptId,
    );
    if (!order || !attempt) throw orderNotFound();
    if (order.paymentStatus === "PAID") {
      throw new AirwallexPaymentAlreadyProcessedError();
    }

    let mismatch = creationMismatch(prepared, intent);
    if (
      !mismatch &&
      attempt.transactionId &&
      attempt.transactionId !== intent.id
    ) {
      mismatch = "PAYMENT_INTENT_MISMATCH";
    }
    const rawResponse = sanitizedIntent(intent);
    const consumedIntent = await tx.paymentTransaction.findFirst({
      where: {
        provider: "AIRWALLEX",
        transactionId: intent.id,
        id: { not: attempt.id },
      },
      select: { id: true },
    });
    if (consumedIntent) {
      await quarantineAttempt(tx, {
        attemptId: attempt.id,
        fromStatus: attempt.status,
        providerStatus: intent.status,
        reason: "PAYMENT_INTENT_MISMATCH",
        rawResponse,
      });
      return { status: "REQUIRES_REVIEW", requiresReview: true };
    }
    if (mismatch) {
      await quarantineAttempt(tx, {
        attemptId: attempt.id,
        fromStatus: attempt.status,
        providerStatus: intent.status,
        paymentIntentId: intent.id,
        reason: mismatch,
        rawResponse,
      });
      return { status: "REQUIRES_REVIEW", requiresReview: true };
    }

    const status = mapAirwallexPaymentStatus(intent.status);
    if (!isLegalAirwallexTransition(attempt.status, status)) {
      await quarantineAttempt(tx, {
        attemptId: attempt.id,
        fromStatus: attempt.status,
        providerStatus: intent.status,
        paymentIntentId: intent.id,
        reason: "ILLEGAL_STATE_TRANSITION",
        rawResponse,
      });
      return { status: "REQUIRES_REVIEW", requiresReview: true };
    }

    const requiresReview = status === "PENDING_REVIEW";
    await tx.paymentTransaction.update({
      where: { id: attempt.id },
      data: {
        transactionId: intent.id,
        providerStatus: intent.status,
        status,
        rawResponse,
        failureCode: sanitizeAirwallexCode(
          intent.latest_payment_attempt?.failure_code,
        ),
        // Never persist provider free-text failure prose; safe customer copy
        // is derived from internal status/review codes at the API boundary.
        failureMessage: null,
        requiresReview,
        reviewReason: requiresReview ? "PENDING_REVIEW" : null,
      },
    });
    await appendAirwallexTransition(tx, {
      paymentTransactionId: attempt.id,
      source: "INITIATION",
      eventName: "payment_intent.created",
      fromStatus: attempt.status,
      toStatus: status,
      providerStatus: intent.status,
      requiresReview,
    });
    return { status, requiresReview };
  });
}

function hostedPageConfig(
  prepared: PreparedAttempt,
  intent: AirwallexPaymentIntentRetrieveResponse & { client_secret: string },
): AirwallexHostedPaymentPageConfig {
  const config = requireAirwallexConfig();
  const urls = buildAirwallexReturnUrls(prepared.orderId);
  return {
    intentId: intent.id,
    clientSecret: intent.client_secret,
    currency: prepared.paymentCurrency,
    environment: config.browserEnvironment,
    successUrl: urls.successUrl,
    cancelUrl: urls.cancelUrl,
  };
}

async function applyRetrievedIntent(
  intent: AirwallexPaymentIntentRetrieveResponse,
): Promise<PaymentTransactionStatus> {
  const result = await applyAuthoritativeAirwallexPayment({
    authoritative: toAirwallexAuthoritativePayment(intent),
    source: "INITIATION",
  });
  if (result.requiresReview) {
    throw new AirwallexStateTransitionError();
  }
  if (result.status === "SUCCESS") {
    throw new AirwallexPaymentAlreadyProcessedError();
  }
  return result.status;
}

async function cancelUnusableIntent(
  intent: AirwallexPaymentIntentRetrieveResponse,
): Promise<void> {
  if (!CANCELLABLE_PROVIDER_STATUSES.has(intent.status)) {
    throw new AirwallexStateTransitionError();
  }
  const cancelled = await cancelAirwallexPaymentIntent(intent.id);
  await applyRetrievedIntent(cancelled);
}

/**
 * Initiate or safely resume one customer-owned Hosted Payment Page checkout.
 * The client secret exists only in this call stack and in the immediate JSON
 * response; it is never persisted or logged.
 */
export async function initiateAirwallexPayment(
  customer: PaymentOrderCustomer,
  orderId: string,
): Promise<AirwallexHostedPaymentPageConfig> {
  requireAirwallexConfig();

  let preparedResult = await prepareAttempt(customer, orderId);
  if (!preparedResult.ok) throw new AirwallexStateTransitionError();
  let prepared = preparedResult.value;

  if (prepared.paymentIntentId) {
    const existing = await retrieveAirwallexPaymentIntent(
      prepared.paymentIntentId,
    );
    const status = await applyRetrievedIntent(existing);
    const replacingTerminalAttempt = ["FAILED", "EXPIRED"].includes(
      prepared.status,
    );
    if (replacingTerminalAttempt) {
      if (existing.status !== "CANCELLED") {
        await cancelUnusableIntent(existing);
      }
      preparedResult = await prepareAttempt(customer, orderId);
      if (!preparedResult.ok) throw new AirwallexStateTransitionError();
      prepared = preparedResult.value;
    } else if (
      REDIRECTABLE_PROVIDER_STATUSES.has(existing.status) &&
      existing.client_secret &&
      isClientSecretFresh(existing.created_at)
    ) {
      logAirwallexEvent({
        event: "PAYMENT_INTENT_REUSED",
        orderId: prepared.orderId,
        paymentAttemptId: prepared.attemptId,
        paymentIntentId: existing.id,
        baseCurrency: prepared.baseCurrency,
        displayCurrency: prepared.displayCurrency,
        paymentCurrency: prepared.paymentCurrency,
        baseAmount: prepared.baseAmount,
        paymentAmount: prepared.paymentAmount,
        exchangeRate: prepared.exchangeRate,
        exchangeRateAt: prepared.exchangeRateAt,
        toStatus: status,
      });
      return hostedPageConfig(
        prepared,
        existing as AirwallexPaymentIntentRetrieveResponse & {
          client_secret: string;
        },
      );
    }

    if (!replacingTerminalAttempt && ["CANCELLED", "FAILED", "EXPIRED"].includes(status)) {
      preparedResult = await prepareAttempt(customer, orderId);
      if (!preparedResult.ok) throw new AirwallexStateTransitionError();
      prepared = preparedResult.value;
    } else if (!replacingTerminalAttempt) {
      await cancelUnusableIntent(existing);
      preparedResult = await prepareAttempt(customer, orderId);
      if (!preparedResult.ok) throw new AirwallexStateTransitionError();
      prepared = preparedResult.value;
    }
  }

  const urls = buildAirwallexReturnUrls(prepared.orderId);
  logAirwallexEvent({
    event: "PAYMENT_INTENT_CREATE_REQUESTED",
    orderId: prepared.orderId,
    paymentAttemptId: prepared.attemptId,
    baseCurrency: prepared.baseCurrency,
    displayCurrency: prepared.displayCurrency,
    paymentCurrency: prepared.paymentCurrency,
    baseAmount: prepared.baseAmount,
    paymentAmount: prepared.paymentAmount,
    exchangeRate: prepared.exchangeRate,
    exchangeRateAt: prepared.exchangeRateAt,
  });
  let created: Awaited<ReturnType<typeof createAirwallexPaymentIntent>>;
  try {
    created = await createAirwallexPaymentIntent({
      request_id: prepared.requestId,
      amount: Number(prepared.paymentAmount),
      currency: BASE_CURRENCY,
      merchant_order_id: prepared.orderId,
      return_url: urls.successUrl,
      metadata: {
        sextoy_order_id: prepared.orderId,
        sextoy_payment_attempt_id: prepared.attemptId,
        sextoy_base_currency: prepared.baseCurrency,
        sextoy_base_amount: prepared.baseAmount,
        sextoy_display_currency: prepared.displayCurrency,
        sextoy_payment_currency: prepared.paymentCurrency,
        sextoy_exchange_rate: prepared.exchangeRate,
        sextoy_exchange_rate_at: prepared.exchangeRateAt,
      },
    });
  } catch (error) {
    if (isDefinitiveCreateRejection(error)) {
      await recordDefinitiveCreateRejection(prepared, error);
    }
    throw error;
  }
  const persisted = await persistCreatedIntent(customer, prepared, created);
  if (persisted.requiresReview) throw new AirwallexStateTransitionError();
  if (persisted.status === "SUCCESS") {
    await applyRetrievedIntent(created);
  }
  if (!REDIRECTABLE_PROVIDER_STATUSES.has(created.status)) {
    throw new AirwallexStateTransitionError();
  }

  logAirwallexEvent({
    event: "PAYMENT_INTENT_CREATED",
    orderId: prepared.orderId,
    paymentAttemptId: prepared.attemptId,
    paymentIntentId: created.id,
    baseCurrency: prepared.baseCurrency,
    displayCurrency: prepared.displayCurrency,
    paymentCurrency: prepared.paymentCurrency,
    baseAmount: prepared.baseAmount,
    paymentAmount: prepared.paymentAmount,
    exchangeRate: prepared.exchangeRate,
    exchangeRateAt: prepared.exchangeRateAt,
    toStatus: persisted.status,
  });
  return hostedPageConfig(prepared, created);
}
