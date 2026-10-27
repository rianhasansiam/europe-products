# SexToy

SexToy is a Next.js storefront and administration app for **https://sextoybd.net**.
New orders use USD and Airwallex. PostgreSQL/Prisma stores catalog, customers,
orders and immutable payment history. English and Bengali catalogs are bundled.

## Local setup

Use Node.js 22.23.2 or a compatible supported runtime, npm, and a dedicated
PostgreSQL database. Read installed Next.js guides in `node_modules/next/dist/docs/`
before changing framework code.

```sh
npm ci
cp .env.example .env
```

Fill `DATABASE_URL` with your own development database connection and generate an
app-specific `AUTH_SECRET`. Keep all secret files out of Git. For local callbacks,
add these overrides to ignored `.env.development.local`:

```dotenv
AUTH_URL=http://localhost:3000
AIRWALLEX_RETURN_URL=http://localhost:3000/orders/payment-return
```

Keep canonical SEO URLs on `https://sextoybd.net`. Apply migrations and start:

```sh
npx prisma migrate deploy
npm run dev
```

Do not seed or restore customer backups into development. There is no bundled
production seed or default administrator account. New installations are empty;
register the owner's real account before granting administrator access through
an authorized database operation.

Catalog prices are used directly in USD; no price-review approval is required.
See [USD pricing](docs/usd-pricing-migration.md) and
[Airwallex setup](docs/airwallex.md). Historical orders retain their saved currencies.

## Optional services

- Google OAuth appears only when both OAuth credentials are configured. Register
  the new domain's callback in the Google OAuth application.
- EmailJS requires the three public EmailJS settings; review its external email
  template and sender branding before enabling notifications.
- Meta Pixel remains disabled when its public ID is blank.
- The website is English-only; language switching and translation management
  have been removed. Stored catalogs and optional native LibreTranslate tooling
  remain available. See [local translation setup](docs/translation-local-setup.md)
  and [translation architecture](docs/translation-architecture.md).
- Uploads use a dedicated persistent filesystem directory outside the release;
  point `UPLOAD_PUBLIC_URL` to that deployment's upload path.

For an explicitly chosen VPS database tunnel, set an SSH target:

```sh
VPS_SSH_TARGET=user@your-host npm run db:tunnel
```

The default local tunnel port is `15434`; override with `VPS_DB_LOCAL_PORT`.
Only connect with this app's dedicated database role/name. Writes against a
production connection affect production data.

## Validation

```sh
npm run lint
npm run typecheck
npm run i18n:validate
npm test
npm run test:airwallex
npm run build
python3 -m unittest discover -s scripts/tests -p 'test_upload_storage.py'
```

The real PostgreSQL guest suite is opt-in and accepts only a disposable loopback
database named `sextoy_guest_checkout_test`, configured through
`GUEST_CHECKOUT_TEST_DATABASE_URL`. Never point tests at the application database.

## Deployment and source privacy

Use [the isolated VPS deployment guide](docs/deployment.md). Keep each project in
its own directory, database, service, loopback port and upload directory. Avoid
restarting unrelated processes or changing other virtual hosts.

This repository intentionally starts with clean history. Database dumps, private
operational reports, secrets, generated clients, build artifacts and translation
runtime caches are excluded. Historical financial data belongs in private
backups, not a public Git repository.


npx prisma studio --port 5555
runuser -u sextoy -- git -C /var/www/europe-products pull origin main
