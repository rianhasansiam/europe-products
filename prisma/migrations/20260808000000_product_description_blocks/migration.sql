-- Add the descriptionBlocks column to the Product table.
-- This is a nullable JSONB column; existing rows will have NULL which
-- causes the public renderer to fall back to the legacy `description`
-- plain-text field. No data migration is required.
ALTER TABLE "Product" ADD COLUMN "descriptionBlocks" jsonb;
