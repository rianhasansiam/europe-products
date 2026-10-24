# USD pricing activation

SexToy accepts only USD for new orders. The runtime currency is defined once in
`lib/currency/config.ts`; request headers, IP addresses, cookies and client
payloads cannot choose a transaction currency. No exchange-rate API is used.

The previous catalog was priced in BDT. Changing its label would charge the
wrong amount. Migrations `20261024000000_usd_pricing_review` and
`20261024001000_airwallex_order_default` preserve existing
monetary values and requires an explicit review before checkout can resume.
No production data migration has been performed by editing this repository.

1. Keep the storefront in maintenance during the pricing cutover. Back up and
   verify recovery for the intended database. Apply the additive
   migration through the existing deployment process and regenerate Prisma.
2. Keep `StoreSettings.pricingCurrencyVerified=false` while reviewing prices.
   Decide whether to reprice products manually or convert them using an
   owner-approved fixed rate and rounding rule. Record that decision and rate;
   the application intentionally supplies neither an invented rate nor an
   automatic conversion.
3. Review every current `Product` buying/sale/discount price, all variant price
   overrides, shipping fees, free-shipping thresholds, flat promo values,
   promo minimums and maximum discounts. Percentage rates remain percentages.
   Review catalog prices together so newly edited and legacy amounts cannot mix.
4. Preserve historical `Order`, `OrderItem`, payment transaction, currency/rate
   snapshots, capital/cost ledger and audit amounts. Existing non-USD orders
   are read-only for new payment initiation. The additive migration labels old
   capital/cost ledger entries BDT and gives future entries a USD default;
   their numeric values are not converted. Retain old exchange-rate rows and
   migration files as historical evidence even though no refresh service uses them.
5. After reviewing and applying the approved current pricing changes, use a
   controlled database transaction to set the existing singleton settings row's
   `currency='USD'` and `pricingCurrencyVerified=true`. Do not toggle this flag
   merely to clear the checkout error. Ordinary settings updates cannot convert
   a legacy currency or mark pricing verified. Admin product edits invalidate
   catalog caches; bulk SQL edits bypass that mechanism. Before reopening the
   storefront, deploy a fresh build without carrying forward the old Next data
   cache and restart the application, so catalog and settings caches cannot
   serve pre-migration prices or verification state.
6. In staging, verify catalog/cart/checkout totals, discounts, tax, shipping,
   order snapshots, Airwallex USD amount and receipts using sandbox payments.
   Verify guest and registered flows and unsuccessful payment outcomes.

Guest cart, saved-for-later and wishlist caches use new USD-specific keys at
cutover; previous browser storage is left untouched and guest shopping lists
start fresh. Saved order history and purchase deduplication keys are preserved.
Price-dependent shopping actions pause while prices are unverified.

Until verification, public price components hide unreviewed amounts, product
structured data omits Offers, and server checkout/payment creation refuses to
create a charge. Admin pricing screens retain the saved pricing currency so
operators can review existing data accurately.

Financial dashboard/report summaries cover USD orders only. Historical orders
and receipts retain their saved currencies; no sum combines USD and BDT amounts.
Capital summaries cover the USD ledger; historical ledger rows keep their own
currencies. Historical database, host account, SSH-key and backup names are
compatibility identifiers and are not automatically renamed.

Guest cart, wishlist, and saved-for-later browser caches use new USD-specific keys at cutover. Existing browser values remain untouched under their legacy keys, but guest shopping lists restart to prevent old BDT cache values from being shown as USD. Signed-in cart and wishlist entries reload their current prices from the server. Order snapshots, guest order cookies, and purchase deduplication markers remain intact.
