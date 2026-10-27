# USD pricing

SexToy accepts only USD for new orders. The runtime currency is defined once in
`lib/currency/config.ts`; request headers, IP addresses, cookies and client
payloads cannot choose a transaction currency. No exchange-rate API is used.

Current catalog sale/discount prices, variant price overrides, shipping fees,
thresholds and flat promo amounts are used directly as USD amounts. The runtime
does not convert stored values. Manual price-review approval was removed on
27 October 2026: price display, product Offers and checkout no longer depend on
`StoreSettings.pricingCurrencyVerified`. The retained database flag is historical
and does not need to be toggled.

Product edits invalidate catalog caches. Bulk SQL edits bypass that mechanism;
invalidate affected caches or deploy a fresh build when changing prices outside
the admin interface. Verify catalog/cart/checkout totals, discounts, tax,
shipping, order snapshots, Airwallex USD amounts and receipts using sandbox
payments before enabling production payment credentials.

Sales dashboard/report summaries cover USD orders only. Historical orders,
receipts, payment transactions and currency/rate snapshots retain their saved
values and currencies. Existing non-USD orders remain unavailable for new
payment initiation; no total combines USD and BDT amounts.

Guest cart, wishlist and saved-for-later caches use USD-specific keys. Legacy
browser values remain untouched under their old keys; signed-in shopping lists
reload current prices from the server. Order snapshots, guest order cookies and
purchase deduplication markers remain intact.

## Historical migration

The previous catalog was priced in BDT. Migrations
`20261024000000_usd_pricing_review` and
`20261024001000_airwallex_order_default` preserved stored monetary values and
introduced the former approval gate. They remain in migration history; they do
not impose a review requirement in the current runtime. Historical ledger and
exchange-rate rows remain stored without numeric conversion. Editing this
repository does not perform a production data migration.
