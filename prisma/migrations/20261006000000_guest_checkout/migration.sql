CREATE TABLE "GuestCustomer" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "postalCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GuestCustomer_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order"
    ADD COLUMN "guestCustomerId" TEXT,
    ADD COLUMN "guestAccessTokenHash" TEXT,
    ADD COLUMN "checkoutKey" TEXT,
    ADD COLUMN "checkoutFingerprint" TEXT;

CREATE INDEX "GuestCustomer_createdAt_idx" ON "GuestCustomer"("createdAt");
CREATE INDEX "Order_guestCustomerId_createdAt_idx" ON "Order"("guestCustomerId", "createdAt");
CREATE UNIQUE INDEX "Order_checkoutKey_key" ON "Order"("checkoutKey");
ALTER TABLE "Order" ADD CONSTRAINT "Order_guestCustomerId_fkey"
    FOREIGN KEY ("guestCustomerId") REFERENCES "GuestCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_customer_identity_check"
    CHECK ("userId" IS NULL OR "guestCustomerId" IS NULL);
ALTER TABLE "Order" ADD CONSTRAINT "Order_guest_access_check"
    CHECK ("guestAccessTokenHash" IS NULL OR ("guestCustomerId" IS NOT NULL AND "userId" IS NULL));
