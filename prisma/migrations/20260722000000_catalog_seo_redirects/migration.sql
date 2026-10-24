-- CreateEnum
CREATE TYPE "ProductCondition" AS ENUM ('NEW', 'REFURBISHED', 'USED');

-- CreateEnum
CREATE TYPE "CatalogRedirectEntityType" AS ENUM ('PRODUCT', 'CATEGORY', 'BRAND');

-- AlterTable
ALTER TABLE "Category"
ADD COLUMN "seoTitle" TEXT,
ADD COLUMN "metaDescription" TEXT,
ADD COLUMN "ogImage" TEXT;

-- AlterTable
ALTER TABLE "Brand"
ADD COLUMN "seoTitle" TEXT,
ADD COLUMN "metaDescription" TEXT,
ADD COLUMN "ogImage" TEXT;

-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "seoTitle" TEXT,
ADD COLUMN "metaDescription" TEXT,
ADD COLUMN "ogImage" TEXT,
ADD COLUMN "gtin" TEXT,
ADD COLUMN "itemCondition" "ProductCondition" NOT NULL DEFAULT 'NEW';

-- Backfill existing images without overwriting manually authored alt text.
UPDATE "ProductImage" AS image
SET "alt" = CASE
    WHEN image."position" = 0 THEN product."name"
    ELSE product."name" || ' image ' || (image."position" + 1)::TEXT
END
FROM "Product" AS product
WHERE image."productId" = product."id"
  AND (image."alt" IS NULL OR BTRIM(image."alt") = '');

-- CreateTable
CREATE TABLE "CatalogRedirect" (
    "id" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "destinationPath" TEXT NOT NULL,
    "entityType" "CatalogRedirectEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "permanent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogRedirect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogRedirect_sourcePath_key" ON "CatalogRedirect"("sourcePath");

-- CreateIndex
CREATE INDEX "CatalogRedirect_destinationPath_idx" ON "CatalogRedirect"("destinationPath");

-- CreateIndex
CREATE INDEX "CatalogRedirect_entityType_entityId_idx" ON "CatalogRedirect"("entityType", "entityId");
