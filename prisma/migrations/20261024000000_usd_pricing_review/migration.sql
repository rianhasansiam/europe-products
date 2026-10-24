-- Defaults affect future records only. Historical amounts/currencies are immutable.
ALTER TABLE "Order" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "Order" ALTER COLUMN "baseCurrency" SET DEFAULT 'USD';
ALTER TABLE "Order" ALTER COLUMN "displayCurrency" SET DEFAULT 'USD';
ALTER TABLE "PaymentTransaction" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "StoreSettings" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "StoreSettings" ALTER COLUMN "standardShippingFee" SET DEFAULT 0;
ALTER TABLE "StoreSettings" ALTER COLUMN "expressShippingFee" SET DEFAULT 0;
ALTER TABLE "StoreSettings" ALTER COLUMN "freeShippingThreshold" SET DEFAULT 0;
ALTER TABLE "StoreSettings" ADD COLUMN "pricingCurrencyVerified" BOOLEAN NOT NULL DEFAULT false;
-- Deliberately do not UPDATE legacy StoreSettings.currency or any monetary values.
-- Checkout remains closed until all current catalog/rule amounts are reviewed as USD.
-- Keep ExchangeRate rows and historical payment columns for audit history.

-- Existing independent cost/capital ledger entries were recorded in BDT.
-- Stamp the provenance without changing an amount; only future entries default to USD.
ALTER TABLE "AdminCapital" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'BDT';
ALTER TABLE "AdminCapital" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "AdminOtherCost" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'BDT';
ALTER TABLE "AdminOtherCost" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "AdminCapitalCostActivity" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'BDT';
ALTER TABLE "AdminCapitalCostActivity" ALTER COLUMN "currency" SET DEFAULT 'USD';
