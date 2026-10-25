# Airwallex checkout

Airwallex is SexToy's only payment integration. New orders and intents use USD
from `lib/currency/config.ts`. Server pricing, availability, stock, promotions,
shipping and taxes determine the saved total; browser amounts are not trusted.
Complete [USD pricing verification](usd-pricing-migration.md) before activation.

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
