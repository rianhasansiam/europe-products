-- Add Airwallex as a first-class order payment method without changing any
-- existing payment-method values.
ALTER TYPE "PaymentMethod" ADD VALUE 'AIRWALLEX';

-- Extend the shared payment-attempt state machine. Existing SUCCESS is the
-- internal equivalent of Airwallex SUCCEEDED and remains unchanged.
ALTER TYPE "PaymentTransactionStatus" ADD VALUE 'CREATED';
ALTER TYPE "PaymentTransactionStatus" ADD VALUE 'REQUIRES_PAYMENT_METHOD';
ALTER TYPE "PaymentTransactionStatus" ADD VALUE 'PENDING_REVIEW';
ALTER TYPE "PaymentTransactionStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "PaymentTransactionStatus" ADD VALUE 'REQUIRES_REVIEW';

-- Snapshot currency on the order so a later payment initiation cannot
-- reinterpret an existing total after store settings change.
ALTER TABLE "Order"
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'BDT';

-- Reuse PaymentTransaction as the Airwallex payment-attempt aggregate.
-- transactionId stores the PaymentIntent ID and idempotencyKey stores the
-- Airwallex request_id, retaining the existing provider-scoped uniqueness.
ALTER TABLE "PaymentTransaction"
ADD COLUMN "providerStatus" TEXT,
ADD COLUMN "failureCode" TEXT,
ADD COLUMN "failureMessage" TEXT,
ADD COLUMN "lastReconciledAt" TIMESTAMP(3),
ADD COLUMN "reconciliationResult" TEXT,
ADD COLUMN "reconciliationAttempts" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "PaymentTransaction_provider_status_updatedAt_idx"
ON "PaymentTransaction"("provider", "status", "updatedAt");

CREATE TYPE "AirwallexEventProcessingStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'RETRY_PENDING',
    'PROCESSED',
    'REQUIRES_REVIEW'
);

CREATE TYPE "PaymentTransactionEventSource" AS ENUM (
    'INITIATION',
    'WEBHOOK',
    'RECONCILIATION',
    'MANUAL'
);

-- Durable, deduplicated Airwallex webhook ingestion. Envelope and sanitized
-- payload fields are immutable by repository convention; only processing and
-- lease fields are updated by workers.
CREATE TABLE "AirwallexWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "accountId" TEXT,
    "apiVersion" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStatus" "AirwallexEventProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processingAttempts" INTEGER NOT NULL DEFAULT 0,
    "sanitizedPayload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockToken" TEXT,
    "paymentTransactionId" TEXT,

    CONSTRAINT "AirwallexWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- Append-only payment transition ledger shared by webhook and reconciliation
-- processing. It is distinct from the mutable webhook processing record.
CREATE TABLE "PaymentTransactionEvent" (
    "id" TEXT NOT NULL,
    "paymentTransactionId" TEXT NOT NULL,
    "source" "PaymentTransactionEventSource" NOT NULL,
    "eventName" TEXT NOT NULL,
    "fromStatus" "PaymentTransactionStatus",
    "toStatus" "PaymentTransactionStatus" NOT NULL,
    "providerStatus" TEXT,
    "providerEventId" TEXT,
    "reasonCode" TEXT,
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransactionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AirwallexWebhookEvent_eventId_key"
ON "AirwallexWebhookEvent"("eventId");

CREATE INDEX "AirwallexEvent_claimable_idx"
ON "AirwallexWebhookEvent"("processingStatus", "nextAttemptAt", "receivedAt");

CREATE INDEX "AirwallexEvent_stale_claim_idx"
ON "AirwallexWebhookEvent"("processingStatus", "lockedAt");

CREATE INDEX "AirwallexEvent_intent_received_idx"
ON "AirwallexWebhookEvent"("paymentIntentId", "receivedAt");

CREATE INDEX "AirwallexEvent_attempt_received_idx"
ON "AirwallexWebhookEvent"("paymentTransactionId", "receivedAt");

CREATE INDEX "PaymentTransactionEvent_attempt_created_idx"
ON "PaymentTransactionEvent"("paymentTransactionId", "createdAt");

CREATE INDEX "PaymentTransactionEvent_provider_event_idx"
ON "PaymentTransactionEvent"("providerEventId");

ALTER TABLE "AirwallexWebhookEvent"
ADD CONSTRAINT "AirwallexWebhookEvent_paymentTransactionId_fkey"
FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentTransactionEvent"
ADD CONSTRAINT "PaymentTransactionEvent_paymentTransactionId_fkey"
FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
