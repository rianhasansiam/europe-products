# SexToy implementation and release checklist

Repository validation completed 24 October 2026 (Asia/Dhaka). These changes are
local source/configuration changes. No production migration, deployment, DNS,
provider dashboard update or live payment was performed.

## Implemented

- SexToy branding, new wordmark/icons, `https://sextoybd.com` canonical metadata,
  Open Graph, structured data, sitemap/robots, receipts, UI and translated text.
- Removed public business phone numbers, telephone contact buttons, physical
  addresses and maps. Customer delivery/billing/contact fields remain available.
- USD-only server pricing, order creation and Airwallex intent creation, backed
  by `lib/currency/config.ts`. Removed visitor-country detection, currency
  cookies/selectors, exchange-rate services, refresh/debug routes and obsolete
  tests/runbooks. Historical snapshots and migrations remain intact.
- Removed active SSLCommerz initialization, callbacks, webhooks, reconciliation,
  gateway code and independent/manual checkout collection. Airwallex remains the
  only new payment provider. Legacy ledger labels and offline historical review
  operations remain for existing records; they do not initiate old-gateway payments.
- New uninitiated reservations can cancel atomically with an audit event and
  stock/promo restoration. In-flight and ambiguous provider requests stay protected.
- USD summaries exclude other currencies, while historical receipts/ledger rows
  retain their saved currencies. Counts/recency still include historical orders.
- New guest orders use public checkout to establish private receipt/payment access.
  Staff-created orders require a registered customer, who pays from their order page.
- USD shopping-cache keys quarantine legacy BDT browser prices without deleting
  old storage. Orders, guest access and purchase deduplication identities remain.

## Configuration

`.env`, ignored `.env.development.local`, and new `.env.example` were updated.
Existing retained secret values were preserved; secret files remain Git-ignored.

| Change | Variables |
| --- | --- |
| Canonical URLs | `SITE_URL`, `NEXT_PUBLIC_SITE_URL`, `AUTH_URL`, `UPLOAD_PUBLIC_URL`, `AIRWALLEX_RETURN_URL` |
| Local development overrides | `AUTH_URL=http://localhost:3000`, sandbox `AIRWALLEX_RETURN_URL=http://localhost:3000/orders/payment-return` in `.env.development.local` |
| Removed from local configuration | `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_IS_LIVE`, `PAYMENT_RECONCILIATION_SECRET`, `EXCHANGE_RATE_API_KEY`, `EXCHANGE_RATE_REFRESH_HOURS`, `CRON_SECRET`, `GEO_COUNTRY_HEADER` |
| No longer supported | `DEV_COUNTRY`, `CURRENCY_DEBUG_SECRET` and retired-provider/FX configuration |
| Currency | No environment override; fixed USD configuration plus a database pricing-review gate |

Required local Airwallex variables are present and pass configuration parsing;
credential authentication against Airwallex was not tested. The existing local
configuration remains sandbox. Database names, SSH identities/key paths and
existing upload directories were preserved because they refer to provisioned
infrastructure, not public branding. The public upload URL uses the new domain.

## Validation

| Check | Final result |
| --- | --- |
| Full Vitest suite | Passed: 987 tests; 4 skipped, 74 passing files and 1 skipped file |
| PostgreSQL guest checkout/cancellation | Included and passed against a disposable loopback database |
| Production build | Passed against the disposable database |
| TypeScript | Passed |
| ESLint | Passed: 0 errors, 2 existing unused-variable warnings in `CarouselBanner.tsx` and `features/http/api-envelope.ts` |
| i18n | Passed; English/Bengali catalogs, 2,876 required messages per locale |
| Python upload helper | 8 tests passed |
| Prisma schema and migration drift | Valid schema; no difference after all 16 migrations |
| Historical migration rehearsal | 7 assertions passed: product/settings/order/payment amounts unchanged; ledger BDT provenance retained |
| Production-server HTTP checks | Passed: branding/contact cleanup, canonical URLs, USD preview despite forged currency/country, retired routes 404, sitemap/robots, unreviewed-price concealment and checkout 503 |
| Browser | English/Bengali contact page and updated layout inspected |
| Source audit / diff whitespace | Passed; no old owned domain, public business contact fields, or retired runtime environment lookups |

Skipped: real LibreTranslate integration and optional RTL fixture generation.
Unrun: real Airwallex sandbox/live payment processing, live webhook delivery,
external dashboard/account settings, DNS/TLS and production deployment checks.
No final required repository check is failing. Earlier fixture/replay failures
were resolved before the final suite.

## Before accepting orders

1. Follow [USD pricing migration](usd-pricing-migration.md). Apply both additive
   migrations and obtain an approved repricing/conversion decision. Review current
   products, variants, shipping and flat promo amounts before setting
   `StoreSettings.currency='USD'` and `pricingCurrencyVerified=true`.
   Checkout intentionally stays closed until this review is complete.
2. Reopen only after cache invalidation/fresh build and deployment verification.
   Preserve historical orders/payments/ledger amounts; no automatic FX rate or
   numeric conversion was selected.
3. Provision DNS, TLS, canonical/www redirects, hosting/deployment URLs and the
   new upload-domain mapping. Existing host accounts/paths require a separate
   migration if they are to be renamed.
4. Update Google OAuth authorized origins/callbacks, Airwallex return/webhook
   destinations and its reconciliation job using [Airwallex setup](airwallex.md).
   Remove retired provider/currency refresh jobs from the host.
5. Verify external EmailJS templates and sender branding/contact details. The
   existing support mailbox was retained rather than inventing a replacement;
   provide a real new mailbox if its old brand spelling should change.
6. Complete Airwallex sandbox success/failure/cancellation/retry/webhook tests
   before activating production payment credentials.

Old names retained in dated audit reports, backups, migration history and
compatibility namespaces are historical evidence/identifiers. Pre-existing user
changes to translation deployment documentation were preserved.
