import "server-only";

import { randomUUID } from "node:crypto";

import {
  Prisma,
  type AirwallexEventProcessingStatus,
  type PaymentTransactionStatus,
} from "@/app/generated/prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";

import { prisma } from "@/lib/db/prisma";
import {
  paymentCustomerOrderWhere,
  type PaymentOrderCustomer,
} from "@/lib/payments/core/payment-order-customer";

import { AIRWALLEX_PROVIDER, AIRWALLEX_LOCAL_RESERVED_STATUS } from "../constants/airwallex.constants";

export type AirwallexTransactionClient = Prisma.TransactionClient;

export const airwallexInitiationOrderInclude = {
  items: {
    select: {
      id: true,
      variantId: true,
      quantity: true,
      unitPrice: true,
      totalPrice: true,
    },
  },
  promoCodeUsages: { select: { id: true }, take: 1 },
  payments: {
    where: { provider: AIRWALLEX_PROVIDER },
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
  },
} satisfies Prisma.OrderInclude;

export type AirwallexInitiationOrder = Prisma.OrderGetPayload<{
  include: typeof airwallexInitiationOrderInclude;
}>;

export async function findOwnerScopedAirwallexOrder(
  tx: AirwallexTransactionClient,
  orderId: string,
  customer: PaymentOrderCustomer,
): Promise<AirwallexInitiationOrder | null> {
  return tx.order.findFirst({
    where: { id: orderId, ...paymentCustomerOrderWhere(customer) },
    include: airwallexInitiationOrderInclude,
  });
}

export function createAirwallexAttempt(
  tx: AirwallexTransactionClient,
  input: {
    id?: string;
    orderId: string;
    requestId: string;
    amount: Prisma.Decimal;
    currency: string;
    baseAmount: Prisma.Decimal;
    baseCurrency: string;
    exchangeRate: Prisma.Decimal;
    exchangeRateAt: Date;
  },
) {
  return tx.paymentTransaction.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      orderId: input.orderId,
      provider: AIRWALLEX_PROVIDER,
      idempotencyKey: input.requestId,
      amount: input.amount,
      currency: input.currency,
      baseAmount: input.baseAmount,
      baseCurrency: input.baseCurrency,
      exchangeRate: input.exchangeRate,
      exchangeRateAt: input.exchangeRateAt,
      status: "CREATED",
      providerStatus: AIRWALLEX_LOCAL_RESERVED_STATUS,
      events: {
        create: {
          source: "INITIATION",
          eventName: "airwallex.attempt.created",
          toStatus: "CREATED",
          providerStatus: AIRWALLEX_LOCAL_RESERVED_STATUS,
        },
      },
    },
  });
}

export type IngestAirwallexEventInput = {
  eventId: string;
  eventName: string;
  paymentIntentId: string;
  accountId?: string;
  apiVersion?: string;
  sanitizedPayload: Prisma.InputJsonValue;
};

export async function ingestAirwallexWebhookEvent(
  input: IngestAirwallexEventInput,
): Promise<{ id: string; duplicate: boolean }> {
  try {
    const event = await prisma.airwallexWebhookEvent.create({
      data: input,
      select: { id: true },
    });
    return { id: event.id, duplicate: false };
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.airwallexWebhookEvent.findUnique({
        where: { eventId: input.eventId },
        select: { id: true },
      });
      if (existing) return { id: existing.id, duplicate: true };
    }
    throw error;
  }
}

export type ClaimedAirwallexEvent = {
  id: string;
  eventId: string;
  eventName: string;
  paymentIntentId: string;
  sanitizedPayload: Prisma.JsonValue;
  processingAttempts: number;
  lockToken: string;
};

type ClaimedRow = Omit<ClaimedAirwallexEvent, "lockToken">;

/** Atomically lease a bounded batch; stale leases are recoverable. */
export async function claimAirwallexWebhookEvents(
  batchSize: number,
  now = new Date(),
  leaseMs = 5 * 60_000,
): Promise<ClaimedAirwallexEvent[]> {
  const take = Math.min(Math.max(Math.trunc(batchSize), 1), 50);
  const staleBefore = new Date(now.getTime() - leaseMs);
  const lockToken = randomUUID();
  const rows = await prisma.$queryRaw<ClaimedRow[]>(Prisma.sql`
    WITH claimable AS (
      SELECT "id"
      FROM "AirwallexWebhookEvent"
      WHERE (
        "processingStatus" IN ('PENDING', 'RETRY_PENDING')
        AND "nextAttemptAt" <= ${now}
      ) OR (
        "processingStatus" = 'PROCESSING'
        AND "lockedAt" <= ${staleBefore}
      )
      ORDER BY "receivedAt" ASC, "id" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${take}
    )
    UPDATE "AirwallexWebhookEvent" AS event
    SET
      "processingStatus" = 'PROCESSING',
      "processingAttempts" = event."processingAttempts" + 1,
      "lockedAt" = ${now},
      "lockToken" = ${lockToken}
    FROM claimable
    WHERE event."id" = claimable."id"
    RETURNING
      event."id",
      event."eventId",
      event."eventName",
      event."paymentIntentId",
      event."sanitizedPayload",
      event."processingAttempts"
  `);
  return rows.map((row) => ({ ...row, lockToken }));
}

export async function releaseAirwallexEventForRetry(input: {
  id: string;
  lockToken: string;
  processingAttempts: number;
  errorCode: string;
  now?: Date;
  maxAttempts?: number;
}): Promise<void> {
  const now = input.now ?? new Date();
  const maxAttempts = input.maxAttempts ?? 5;
  const requiresReview = input.processingAttempts >= maxAttempts;
  const delaySeconds = Math.min(30 * 2 ** (input.processingAttempts - 1), 900);
  const released = await prisma.airwallexWebhookEvent.updateMany({
    where: {
      id: input.id,
      lockToken: input.lockToken,
      processingStatus: "PROCESSING",
    },
    data: {
      processingStatus: requiresReview ? "REQUIRES_REVIEW" : "RETRY_PENDING",
      processingError: input.errorCode.slice(0, 160),
      nextAttemptAt: new Date(now.getTime() + delaySeconds * 1_000),
      lockedAt: null,
      lockToken: null,
      ...(requiresReview ? { processedAt: now } : {}),
    },
  });
  if (released.count !== 1) {
    throw new Error("Airwallex event lease is no longer valid.");
  }
}

export function markAirwallexEventProcessed(
  tx: AirwallexTransactionClient,
  input: {
    id: string;
    lockToken: string;
    paymentTransactionId: string;
    requiresReview?: boolean;
    processingError?: string | null;
  },
) {
  return tx.airwallexWebhookEvent.updateMany({
    where: {
      id: input.id,
      lockToken: input.lockToken,
      processingStatus: "PROCESSING",
    },
    data: {
      paymentTransactionId: input.paymentTransactionId,
      processingStatus: input.requiresReview ? "REQUIRES_REVIEW" : "PROCESSED",
      processingError: input.processingError?.slice(0, 160) ?? null,
      processedAt: new Date(),
      lockedAt: null,
      lockToken: null,
    },
  });
}

export function appendAirwallexTransition(
  tx: AirwallexTransactionClient,
  input: {
    paymentTransactionId: string;
    source: "INITIATION" | "WEBHOOK" | "RECONCILIATION" | "MANUAL";
    eventName: string;
    fromStatus: PaymentTransactionStatus | null;
    toStatus: PaymentTransactionStatus;
    providerStatus?: string | null;
    providerEventId?: string | null;
    reasonCode?: string | null;
    requiresReview?: boolean;
  },
) {
  return tx.paymentTransactionEvent.create({ data: input });
}

export function unresolvedAirwallexAttempts(batchSize: number) {
  return prisma.paymentTransaction.findMany({
    where: {
      provider: AIRWALLEX_PROVIDER,
      transactionId: { not: null },
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
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: Math.min(Math.max(Math.trunc(batchSize), 1), 50),
    select: {
      id: true,
      orderId: true,
      transactionId: true,
      status: true,
      reconciliationAttempts: true,
    },
  });
}

export function recordAirwallexReconciliationResult(input: {
  paymentId: string;
  result: string;
  now?: Date;
}) {
  return prisma.paymentTransaction.updateMany({
    where: { id: input.paymentId, provider: AIRWALLEX_PROVIDER },
    data: {
      lastReconciledAt: input.now ?? new Date(),
      reconciliationResult: input.result.slice(0, 160),
      reconciliationAttempts: { increment: 1 },
    },
  });
}

export type AirwallexEventStatus = AirwallexEventProcessingStatus;
