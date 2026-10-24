# Guest checkout

Checkout supports signed-in customers and unauthenticated guests through the
same pricing, inventory, promotion, order, and payment services. `User.role`
still contains only `USER` and `ADMIN`. Guests have no account, password, or
authenticated session.

## Persistence and access

Each successful guest checkout creates a `GuestCustomer` inside the order
transaction. Orders reference either a registered user or a guest profile.
Contact fields on the order remain the historical delivery snapshot. Guest
contacts are not unique and are never used to find, modify, or authorize a user.
Historical orders retain their existing associations; the migration does not
backfill guest identities.

The read-only preview establishes a random HttpOnly checkout cookie. Public
submission requires that established identity and a UUID idempotency key for
every payment method. Identical attempts serialize through a PostgreSQL
transaction advisory lock and return the original order, including after a
registered full-cart checkout clears its saved cart. The transaction includes
guest creation, stock movements, inventory logs, promotion usage, and payment
reservation. Rollback removes all of these writes if it fails.

Checkout sets a separate unguessable HttpOnly bearer cookie for each guest
order. Only its digest is stored on the order. Guest order detail, Airwallex
retry/status verify that scoped credential.
Order IDs, email addresses, phone numbers, and the general checkout cookie do
not authorize an order read. Access cookies expire in the browser after 30 days
and require HTTPS in production. Clearing cookies or changing browsers loses
guest access; there is no contact-based recovery or order claiming flow.

Profile, registered order history, customer cancellation, admin endpoints, and
other protected features continue to require their existing authorization.
Admins process guest orders through the existing status, cancellation, and
payment-review workflows. Only newly associated guest profiles receive the
Guest label; historical unassociated orders are not relabeled.

The admin Customers page (`/admin/users`) lists registered accounts and guest
checkout profiles together. A customer-type filter selects Guests or Registered
customers; account roles remain a separate registered-only filter. Guest rows
show their submitted contact/address, order count, and non-cancelled order spend,
and have no role-management actions. Repeated contacts remain separate guest
profiles. Guest directory reads use the protected, uncached
`GET /api/admin/guests` endpoint, so refreshing the page fetches current profiles
and order totals.

Airwallex retains optional guest email. Signed-in orders continue using the account email. Payment return flags never establish
payment success; existing provider verification, webhooks, and reconciliation
remain authoritative.

## Deployment

Apply the migration using the existing migration connection configuration,
including [USD pricing verification](usd-pricing-migration.md), then regenerate
the client and build before starting the updated application:

```sh
npx prisma migrate deploy
npx prisma generate
npm run build
```

The migration is
`prisma/migrations/20261006000000_guest_checkout/migration.sql`. No new production
environment variable is required. Existing `AUTH_URL`, database, payment, and
proxy/IP-header configuration remains in use. Production must use HTTPS for
guest cookies. The configured application database was not migrated during
implementation; migration verification used a disposable local PostgreSQL
cluster.

Both public checkout routes enforce same-origin browser requests, persistent
rate limiting, JSON body size limits, and server validation. Guest submissions
also have an IP limit so rotating cookies does not reset the only limit.

## Verification

New orders use USD and Airwallex only. Customer phone and shipping/billing
addresses remain necessary for delivery and fraud checks; they are separate
from removed public business contact information.

Run `npm test` and `npm run test:airwallex`. The PostgreSQL guest suite is opt-in:
set `GUEST_CHECKOUT_TEST_DATABASE_URL` to the exact disposable local database
name required in `__tests__/guest-checkout-database.test.ts`. Never point it at
production. Sandbox payment redirects, webhook delivery and settlement need
separate staging verification as described in [Airwallex setup](airwallex.md).
