-- Change only the default for future rows; historical payment methods remain intact.
ALTER TABLE "Order" ALTER COLUMN "paymentMethod" SET DEFAULT 'AIRWALLEX';
