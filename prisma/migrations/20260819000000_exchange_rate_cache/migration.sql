-- Add a durable cache for the six supported BDT exchange-rate quotes.
-- This migration is additive: existing catalog, order, and payment data is
-- untouched. The application seeds/upserts the rows through the refresh job.
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "rate" DECIMAL(20,10) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExchangeRate_baseCurrency_currency_key"
ON "ExchangeRate"("baseCurrency", "currency");

CREATE INDEX "ExchangeRate_baseCurrency_idx"
ON "ExchangeRate"("baseCurrency");
