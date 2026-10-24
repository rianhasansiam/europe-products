-- Old target-only availability is insufficient to authorize a directed model pair.
-- Preserve language catalogs and publications; refresh capabilities before machine jobs.
ALTER TABLE "LocaleLanguage" ADD COLUMN "providerTargets" JSONB;
UPDATE "LocaleLanguage" SET "available" = false, "providerFetchedAt" = NULL;
