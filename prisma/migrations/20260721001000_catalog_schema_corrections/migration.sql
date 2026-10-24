-- Snapshot flexible variant selections on order items.
ALTER TABLE "OrderItem" ADD COLUMN "variantAttributes" JSONB;

-- Accelerate containment/existence queries over technical specifications.
CREATE INDEX "Product_specifications_idx"
ON "Product" USING GIN ("specifications");
