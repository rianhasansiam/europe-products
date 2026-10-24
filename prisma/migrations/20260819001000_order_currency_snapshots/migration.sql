-- Preserve all existing Order/OrderItem amounts as canonical BDT and add an
-- immutable customer-display snapshot. The nullable-first backfill keeps this
-- migration safe for databases that already contain orders.
ALTER TABLE "Order"
  ADD COLUMN "baseCurrency" TEXT,
  ADD COLUMN "displayCurrency" TEXT,
  ADD COLUMN "displaySubtotal" DECIMAL(12,2),
  ADD COLUMN "displayDeliveryCharge" DECIMAL(12,2),
  ADD COLUMN "displayDiscountAmount" DECIMAL(12,2),
  ADD COLUMN "displayTaxAmount" DECIMAL(12,2),
  ADD COLUMN "displayTotalAmount" DECIMAL(12,2),
  ADD COLUMN "displayAdvancePayment" DECIMAL(12,2),
  ADD COLUMN "exchangeRate" DECIMAL(20,10),
  ADD COLUMN "exchangeRateAt" TIMESTAMP(3);

UPDATE "Order"
SET
  "currency" = 'BDT',
  "baseCurrency" = 'BDT',
  "displayCurrency" = 'BDT',
  "displaySubtotal" = "subtotal",
  "displayDeliveryCharge" = "deliveryCharge",
  "displayDiscountAmount" = "discountAmount",
  "displayTaxAmount" = "taxAmount",
  "displayTotalAmount" = "totalAmount",
  "displayAdvancePayment" = "advancePayment",
  "exchangeRate" = 1;

ALTER TABLE "Order"
  ALTER COLUMN "baseCurrency" SET NOT NULL,
  ALTER COLUMN "baseCurrency" SET DEFAULT 'BDT',
  ALTER COLUMN "displayCurrency" SET NOT NULL,
  ALTER COLUMN "displayCurrency" SET DEFAULT 'BDT',
  ALTER COLUMN "displaySubtotal" SET NOT NULL,
  ALTER COLUMN "displayDeliveryCharge" SET NOT NULL,
  ALTER COLUMN "displayDeliveryCharge" SET DEFAULT 0,
  ALTER COLUMN "displayDiscountAmount" SET NOT NULL,
  ALTER COLUMN "displayDiscountAmount" SET DEFAULT 0,
  ALTER COLUMN "displayTaxAmount" SET NOT NULL,
  ALTER COLUMN "displayTaxAmount" SET DEFAULT 0,
  ALTER COLUMN "displayTotalAmount" SET NOT NULL,
  ALTER COLUMN "displayAdvancePayment" SET NOT NULL,
  ALTER COLUMN "displayAdvancePayment" SET DEFAULT 0,
  ALTER COLUMN "exchangeRate" SET NOT NULL,
  ALTER COLUMN "exchangeRate" SET DEFAULT 1;

ALTER TABLE "OrderItem"
  ADD COLUMN "displayUnitPrice" DECIMAL(12,2),
  ADD COLUMN "displayTotalPrice" DECIMAL(12,2);

UPDATE "OrderItem"
SET
  "displayUnitPrice" = "unitPrice",
  "displayTotalPrice" = "totalPrice";

ALTER TABLE "OrderItem"
  ALTER COLUMN "displayUnitPrice" SET NOT NULL,
  ALTER COLUMN "displayTotalPrice" SET NOT NULL;
