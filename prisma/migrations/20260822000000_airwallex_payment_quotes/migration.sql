-- Preserve the authoritative base amount and the exact payment FX quote on
-- each Airwallex attempt. Columns remain nullable for other providers and for
-- legacy rows whose quote cannot be reconstructed safely.
BEGIN;

ALTER TABLE "PaymentTransaction"
  ADD COLUMN "baseAmount" DECIMAL(12,2),
  ADD COLUMN "baseCurrency" TEXT,
  ADD COLUMN "exchangeRate" DECIMAL(20,10),
  ADD COLUMN "exchangeRateAt" TIMESTAMP(3);

-- Airwallex has never supported partial shopper payments in this application,
-- so the related order total is the authoritative legacy base amount.
UPDATE "PaymentTransaction" AS payment
SET
  "baseAmount" = orders."totalAmount",
  "baseCurrency" = orders."baseCurrency"
FROM "Order" AS orders
WHERE payment."orderId" = orders."id"
  AND payment."provider" = 'AIRWALLEX';

-- Before payment-currency quoting, checkout reserved a LOCAL_CREATED BDT row
-- and initiation sometimes created a second, correctly converted attempt.
-- Expire only an older unbound placeholder with a later non-placeholder
-- Airwallex sibling. This retains a genuine current reservation while making
-- proven orphan rows terminal so they cannot block order cancellation.
WITH superseded AS (
  SELECT placeholder."id"
  FROM "PaymentTransaction" AS placeholder
  WHERE placeholder."provider" = 'AIRWALLEX'
    AND placeholder."transactionId" IS NULL
    AND placeholder."status" = 'CREATED'
    AND placeholder."providerStatus" = 'LOCAL_CREATED'
    AND UPPER(BTRIM(placeholder."currency")) = 'BDT'
    AND EXISTS (
      SELECT 1
      FROM "PaymentTransaction" AS sibling
      WHERE sibling."orderId" = placeholder."orderId"
        AND sibling."provider" = 'AIRWALLEX'
        AND sibling."id" <> placeholder."id"
        AND (
          sibling."createdAt" > placeholder."createdAt"
          OR (
            sibling."createdAt" = placeholder."createdAt"
            AND sibling."id" > placeholder."id"
          )
        )
        AND (
          sibling."transactionId" IS NOT NULL
          OR sibling."status" <> 'CREATED'
          OR COALESCE(sibling."providerStatus", '') <> 'LOCAL_CREATED'
          OR UPPER(BTRIM(sibling."currency")) <> 'BDT'
        )
    )
),
expired AS (
  UPDATE "PaymentTransaction" AS payment
  SET
    "status" = 'EXPIRED',
    "providerStatus" = 'LOCAL_SUPERSEDED',
    "failureCode" = COALESCE(
      payment."failureCode",
      'SUPERSEDED_PLACEHOLDER'
    ),
    "failureMessage" = COALESCE(
      payment."failureMessage",
      'Superseded by a later Airwallex payment attempt.'
    ),
    "updatedAt" = CURRENT_TIMESTAMP
  FROM superseded
  WHERE payment."id" = superseded."id"
  RETURNING payment."id"
)
INSERT INTO "PaymentTransactionEvent" (
  "id",
  "paymentTransactionId",
  "source",
  "eventName",
  "fromStatus",
  "toStatus",
  "providerStatus",
  "reasonCode",
  "requiresReview",
  "createdAt"
)
SELECT
  'airwallex-quote-migration-' || expired."id",
  expired."id",
  'MANUAL',
  'airwallex.attempt.placeholder_expired',
  'CREATED',
  'EXPIRED',
  'LOCAL_SUPERSEDED',
  'SUPERSEDED_PLACEHOLDER',
  false,
  CURRENT_TIMESTAMP
FROM expired;

-- Reprice a remaining active BDT placeholder directly from its authoritative
-- BDT order total into the policy currency. Direct EUR/GBP/CNY/USD payments
-- reuse the order's frozen storefront quote; every other display currency
-- uses the cached direct BDT-to-USD rate. Invalid, missing, non-positive, or
-- out-of-range quotes leave the row untouched so the application fails safely.
WITH quote_candidates AS (
  SELECT
    payment."id",
    policy."paymentCurrency",
    selected_rate."rate",
    selected_rate."fetchedAt",
    ROUND(
      orders."totalAmount" * selected_rate."rate",
      2
    ) AS "paymentAmount"
  FROM "PaymentTransaction" AS payment
  INNER JOIN "Order" AS orders
    ON orders."id" = payment."orderId"
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN UPPER(BTRIM(orders."displayCurrency")) IN (
        'EUR',
        'GBP',
        'CNY',
        'USD'
      ) THEN UPPER(BTRIM(orders."displayCurrency"))
      ELSE 'USD'
    END AS "paymentCurrency"
  ) AS policy
  LEFT JOIN "ExchangeRate" AS rates
    ON rates."baseCurrency" = 'BDT'
   AND rates."currency" = policy."paymentCurrency"
  CROSS JOIN LATERAL (
    SELECT
      CASE
        WHEN UPPER(BTRIM(orders."displayCurrency")) IN (
          'EUR',
          'GBP',
          'CNY',
          'USD'
        ) THEN orders."exchangeRate"
        ELSE rates."rate"
      END AS "rate",
      CASE
        WHEN UPPER(BTRIM(orders."displayCurrency")) IN (
          'EUR',
          'GBP',
          'CNY',
          'USD'
        ) THEN orders."exchangeRateAt"
        ELSE rates."fetchedAt"
      END AS "fetchedAt"
  ) AS selected_rate
  WHERE payment."provider" = 'AIRWALLEX'
    AND payment."transactionId" IS NULL
    AND payment."status" = 'CREATED'
    AND payment."providerStatus" = 'LOCAL_CREATED'
    AND UPPER(BTRIM(payment."currency")) = 'BDT'
    AND UPPER(BTRIM(payment."baseCurrency")) = 'BDT'
    AND orders."totalAmount" > 0
    AND selected_rate."rate" > 0
    AND selected_rate."fetchedAt" IS NOT NULL
),
safe_quotes AS (
  SELECT *
  FROM quote_candidates
  WHERE "paymentAmount" BETWEEN 0.01 AND 9999999999.99
)
UPDATE "PaymentTransaction" AS payment
SET
  "amount" = safe_quotes."paymentAmount",
  "currency" = safe_quotes."paymentCurrency",
  "exchangeRate" = safe_quotes."rate",
  "exchangeRateAt" = safe_quotes."fetchedAt",
  "updatedAt" = CURRENT_TIMESTAMP
FROM safe_quotes
WHERE payment."id" = safe_quotes."id";

-- Preserve an unbound legacy request that was already priced in the policy
-- currency (for example, when the provider response was lost). Never change
-- its amount, currency, or request identity; derive a rate only when the
-- rounded value reconstructs the exact frozen amount.
WITH unbound_effective_rates AS (
  SELECT
    payment."id",
    payment."amount",
    payment."baseAmount",
    ROUND(
      payment."amount" / NULLIF(payment."baseAmount", 0),
      10
    ) AS "effectiveRate"
  FROM "PaymentTransaction" AS payment
  INNER JOIN "Order" AS orders
    ON orders."id" = payment."orderId"
  WHERE payment."provider" = 'AIRWALLEX'
    AND payment."transactionId" IS NULL
    AND payment."exchangeRate" IS NULL
    AND payment."status" = 'CREATED'
    AND payment."providerStatus" = 'LOCAL_CREATED'
    AND payment."amount" > 0
    AND payment."baseAmount" > 0
    AND UPPER(BTRIM(payment."currency")) <> 'BDT'
    AND UPPER(BTRIM(payment."currency")) = CASE
      WHEN UPPER(BTRIM(orders."displayCurrency")) IN (
        'EUR',
        'GBP',
        'CNY',
        'USD'
      ) THEN UPPER(BTRIM(orders."displayCurrency"))
      ELSE 'USD'
    END
),
safe_unbound_effective_rates AS (
  SELECT *
  FROM unbound_effective_rates
  WHERE "effectiveRate" BETWEEN 0.0000000001 AND 9999999999.9999999999
    AND ROUND("baseAmount" * "effectiveRate", 2) = "amount"
)
UPDATE "PaymentTransaction" AS payment
SET
  "exchangeRate" = safe_rates."effectiveRate",
  "exchangeRateAt" = COALESCE(payment."exchangeRateAt", payment."createdAt")
FROM safe_unbound_effective_rates AS safe_rates
WHERE payment."id" = safe_rates."id";

-- A bound legacy attempt is already provider authority: never rewrite its
-- amount or currency. Derive the effective direct rate from the amount that
-- Airwallex actually expects. createdAt is the closest durable quote-time
-- proxy available for these historical rows.
WITH effective_rates AS (
  SELECT
    payment."id",
    payment."amount",
    payment."baseAmount",
    ROUND(
      payment."amount" / NULLIF(payment."baseAmount", 0),
      10
    ) AS "effectiveRate"
  FROM "PaymentTransaction" AS payment
  WHERE payment."provider" = 'AIRWALLEX'
    AND payment."transactionId" IS NOT NULL
    AND payment."exchangeRate" IS NULL
    AND payment."amount" > 0
    AND payment."baseAmount" > 0
),
safe_effective_rates AS (
  SELECT *
  FROM effective_rates
  WHERE "effectiveRate" BETWEEN 0.0000000001 AND 9999999999.9999999999
    AND ROUND("baseAmount" * "effectiveRate", 2) = "amount"
)
UPDATE "PaymentTransaction" AS payment
SET
  "exchangeRate" = safe_effective_rates."effectiveRate",
  "exchangeRateAt" = COALESCE(payment."exchangeRateAt", payment."createdAt")
FROM safe_effective_rates
WHERE payment."id" = safe_effective_rates."id";

COMMIT;
