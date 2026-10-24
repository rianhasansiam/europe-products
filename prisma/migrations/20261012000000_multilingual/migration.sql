-- Additive only: canonical content and financial records remain unchanged.
ALTER TABLE "User" ADD COLUMN "preferredLocale" TEXT;
CREATE TABLE "LocaleLanguage" (
  "code" TEXT NOT NULL, "englishName" TEXT NOT NULL, "nativeName" TEXT NOT NULL,
  "direction" TEXT NOT NULL DEFAULT 'ltr', "fallbackLocale" TEXT,
  "providerCode" TEXT, "available" BOOLEAN NOT NULL DEFAULT false,
  "prepared" BOOLEAN NOT NULL DEFAULT false, "published" BOOLEAN NOT NULL DEFAULT false,
  "publicationOverride" BOOLEAN NOT NULL DEFAULT false,
  "interfaceCatalog" JSONB, "interfaceSourceHash" TEXT, "catalogReviewedAt" TIMESTAMP(3),
  "providerFetchedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "LocaleLanguage_pkey" PRIMARY KEY ("code")
);
CREATE INDEX "LocaleLanguage_published_prepared_idx" ON "LocaleLanguage"("published", "prepared");
CREATE TABLE "ContentTranslation" (
  "id" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL,
  "field" TEXT NOT NULL, "sourceLocale" TEXT NOT NULL, "targetLocale" TEXT NOT NULL,
  "sourceHash" TEXT NOT NULL, "contextHash" TEXT NOT NULL, "value" TEXT NOT NULL,
  "origin" TEXT NOT NULL DEFAULT 'machine', "status" TEXT NOT NULL DEFAULT 'draft',
  "reviewedBy" TEXT, "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentTranslation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContentTranslation_entityType_entityId_field_targetLocale_key" ON "ContentTranslation"("entityType", "entityId", "field", "targetLocale");
CREATE INDEX "ContentTranslation_targetLocale_status_idx" ON "ContentTranslation"("targetLocale", "status");
CREATE INDEX "ContentTranslation_entityType_entityId_status_idx" ON "ContentTranslation"("entityType", "entityId", "status");
CREATE TABLE "TranslationJob" (
  "id" TEXT NOT NULL, "dedupeKey" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL,
  "field" TEXT NOT NULL, "sourceLocale" TEXT NOT NULL, "targetLocale" TEXT NOT NULL,
  "sourceHash" TEXT NOT NULL, "contextHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued', "attempts" INTEGER NOT NULL DEFAULT 0,
  "characters" INTEGER NOT NULL DEFAULT 0, "lastError" TEXT, "lockedAt" TIMESTAMP(3),
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TranslationJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TranslationJob_dedupeKey_key" ON "TranslationJob"("dedupeKey");
CREATE INDEX "TranslationJob_status_nextAttemptAt_idx" ON "TranslationJob"("status", "nextAttemptAt");
CREATE INDEX "TranslationJob_targetLocale_createdAt_idx" ON "TranslationJob"("targetLocale", "createdAt");
