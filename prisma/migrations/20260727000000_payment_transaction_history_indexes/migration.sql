-- Stable newest-first pagination for the complete admin transaction ledger.
CREATE INDEX "PaymentTransaction_createdAt_id_idx"
ON "PaymentTransaction"("createdAt", "id");
