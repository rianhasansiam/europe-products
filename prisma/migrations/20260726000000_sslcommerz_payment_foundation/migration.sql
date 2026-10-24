-- Extend payment enums without removing legacy values.
ALTER TYPE "PaymentMethod" ADD VALUE 'SSLCOMMERZ';
ALTER TYPE "PaymentMethod" ADD VALUE 'PAYPAL';

ALTER TYPE "PaymentStatus" ADD VALUE 'PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE 'FAILED';
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';

ALTER TYPE "PaymentTransactionStatus" ADD VALUE 'EXPIRED';

-- Persist provider initiation and validation metadata on the existing
-- payment-attempt model.
ALTER TABLE "PaymentTransaction"
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "gatewayUrl" TEXT,
ADD COLUMN "gatewaySessionKey" TEXT,
ADD COLUMN "validationId" TEXT,
ADD COLUMN "bankTransactionId" TEXT,
ADD COLUMN "cardType" TEXT,
ADD COLUMN "riskLevel" INTEGER,
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "requiresReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reviewReason" TEXT,
ADD COLUMN "reviewResolvedAt" TIMESTAMP(3),
ADD COLUMN "reviewResolvedBy" TEXT,
ADD COLUMN "reviewResolution" TEXT,
ADD COLUMN "reviewResolutionReference" TEXT;

-- PostgreSQL permits multiple NULL values in these compound unique indexes,
-- preserving existing transactions that do not carry gateway identifiers.
CREATE UNIQUE INDEX "PaymentTransaction_provider_idempotencyKey_key"
ON "PaymentTransaction"("provider", "idempotencyKey");

CREATE UNIQUE INDEX "PaymentTransaction_provider_gatewaySessionKey_key"
ON "PaymentTransaction"("provider", "gatewaySessionKey");

CREATE UNIQUE INDEX "PaymentTransaction_provider_validationId_key"
ON "PaymentTransaction"("provider", "validationId");

CREATE UNIQUE INDEX "PaymentTransaction_provider_bankTransactionId_key"
ON "PaymentTransaction"("provider", "bankTransactionId");

CREATE INDEX "PaymentTransaction_provider_requiresReview_createdAt_idx"
ON "PaymentTransaction"("provider", "requiresReview", "createdAt");

-- Shared fixed-window rate-limit state. Only SHA-256 key digests are stored;
-- caller identity and other raw key material never enter this table.
CREATE TABLE "RateLimitBucket" (
    "keyDigest" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("keyDigest")
);

CREATE INDEX "RateLimitBucket_resetAt_idx"
ON "RateLimitBucket"("resetAt");
