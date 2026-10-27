# Airwallex checkout

Airwallex is SexToy's only payment integration. New orders and intents use USD
from `lib/currency/config.ts`. Server pricing, availability, stock, promotions,
shipping and taxes determine the saved total; browser amounts are not trusted.
Existing catalog amounts are used as USD; activation does not convert prices or
rewrite historical non-USD records.

Staff may create pending Airwallex orders for registered customers, who pay from
their own order page. New guest orders must use public guest checkout so the
customer receives the private order-access cookie. Staff-created historical
guest orders remain available for administration; no public share token is invented.

Copy the Airwallex settings from [.env.example](../.env.example). Enabling the
provider requires a client ID, API key, webhook secret (at least 16 characters),
and independent reconciliation secret (at least 32 characters). Preserve valid
existing secrets. Use sandbox credentials with `AIRWALLEX_ENV=sandbox`; switch
to production only after completing provider-side onboarding and testing.

Configure the external Airwallex dashboard for the deployment:

- Return URL: `https://sextoybd.net/orders/payment-return`
- Webhook: `https://sextoybd.net/api/payments/airwallex/webhook`
- Recovery endpoint: `POST https://sextoybd.net/api/payments/airwallex/reconcile`,
  protected with `Authorization: Bearer <AIRWALLEX_RECONCILIATION_SECRET>`.

## Production activation

The VPS project `.env` links to `/etc/sextoy/production.env`. Edit that protected
file directly as root; keep it `root:sextoy` with mode `0640`. Credentials must
never appear in Git, PM2 ecosystem files, command arguments, or logs.

Keep `AIRWALLEX_ENABLED=false` while preparing the production account. Set
`AIRWALLEX_ENV=production`, install the production client ID/API key, and copy
the secret from the production webhook configured for the exact URL above.
Retain the independent reconciliation secret. A successful sandbox login does
not establish that the same credentials work in production.

Confirm the Payments account is approved for this merchant and catalog and that
the intended payment methods are active. Resolve Airwallex's website disclosure
requirements with the account owner; do not invent or automatically restore
business contact information. In **Payments > Settings**, turn **Automatic
Currency Conversion off**: it can change the PaymentIntent amount and currency,
which conflicts with this application's USD-only verification.

Subscribe the production webhook to the supported `payment_intent.*` events and
`payment_attempt.authentication_failed` / `payment_attempt.authorization_failed`
listed in `lib/airwallex/constants/airwallex.constants.ts`. Keep the dashboard
webhook version compatible with the envelope expected by the application.
Verify signed delivery from Airwallex; a local HMAC test alone does not verify
the dashboard subscription or its secret.

After credentials and dashboard settings have been verified, set
`AIRWALLEX_ENABLED=true` and restart both scoped PM2 processes:

```sh
pm2 restart europe-products
pm2 restart europe-products-reconcile
pm2 logs europe-products-reconcile --lines 50
```

Complete the sandbox success, failure, cancellation and 3DS scenarios first,
then have the owner perform a small real production payment. Check the provider
PaymentIntent and the saved order both confirm the same USD amount. API login,
builds and mocked tests do not establish card acceptance or settlement.

## Reconciliation on the VPS

Webhook ingestion deliberately acknowledges durable storage before looking up
provider state. **The reconciliation worker is required**, even when webhook
delivery succeeds. `scripts/airwallex-reconcile.mjs` runs as the dedicated
`sextoy` account in PM2 as `europe-products-reconcile`, using the same private
environment preloader as the web process.

The worker calls only the loopback reconciliation route, without a browser
Origin, and never logs its bearer token or response body. It runs sequentially
every 30 seconds after a completed request, backs off after failures, and skips
requests while Airwallex is disabled. Keep one worker instance; the endpoint's
existing persistent rate limit and database event leases remain in effect.
Monitor worker errors and payment review holds; the current endpoint drains one
queued webhook and up to ten unresolved payments per request.

For a single manual run with the VPS environment:

```sh
runuser -u sextoy -- /usr/bin/node --require /etc/sextoy/pm2-env.cjs \
  /var/www/europe-products/scripts/airwallex-reconcile.mjs --once
```

The webhook verifies the signature against the raw body and timestamp before
processing. Durable event storage, deduplication, provider verification and
transaction locks protect payment transitions. A success URL or SDK callback
alone is not payment evidence. Cancellation/failure keeps the order unpaid;
retries use the saved order and appropriate idempotency identity. A reservation
that has never started a provider request can be cancelled with stock/promotion
restoration and a ledger event. Once a request has begun (including ambiguous
timeouts), cancellation waits for a safe provider state; older ambiguous
`LOCAL_CREATED` records remain protected. Historical
transactions and pending webhook records are preserved when old gateways are
removed. Legacy non-USD orders cannot receive a new USD payment attempt.

Run `npm run test:airwallex`, `npm test`, `npm run typecheck`, `npm run lint` and
`npm run build`. These mocked tests do not establish real payment settlement.
In staging, test guest/registered checkout, success, cancellation, failed payment,
retry, expired checkout, duplicate/out-of-order events, invalid signatures and
reconciliation. Compare the provider amount/currency against saved USD totals.

The server intent contract follows [Airwallex's payment intent API](https://www.airwallex.com/docs/api/payments/payment_intents/create).
DNS, TLS, deployed environment settings and dashboard URL changes must be made
externally. No live payment or dashboard change is claimed by this document.

Provider references: [production checklist](https://www.airwallex.com/docs/payments/test-and-go-live/integration-checklist),
[webhook configuration and signatures](https://www.airwallex.com/docs/developer-tools/webhooks/listen-for-webhook-events),
[payment activation](https://www.airwallex.com/docs/payments/get-started/payment-method-activation),
[automatic currency conversion](https://www.airwallex.com/docs/payments/online-payments/automatic-currency-conversion),
and [website onboarding requirements](https://www.airwallex.com/docs/payments/payment-methods/payment-method-onboarding-requirement).
