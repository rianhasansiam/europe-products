# Isolated VPS deployment

The canonical origin is `https://sextoybd.net`. Deploy the public repository
`https://github.com/rianhasansiam/europe-products.git` into a new release directory.
Do not replace a running project's checkout, environment, database or uploads.

## Resources

Use a dedicated service user (`sextoy`), release root (`/var/www/europe-products`),
private environment (`/etc/sextoy/production.env`), uploads
(`/var/lib/sextoy/uploads`), and a free loopback port (`3002` in this deployment).
The app runs as `sextoy.service`; it does not join another project's PM2 daemon.
Inspect port/directory/database collisions before creating anything.

Create a unique non-superuser PostgreSQL login/database for this application.
Generate independent random database and auth secrets on the host; store them
only in the protected environment. Do not reuse another site's database or copy
its customer data. Give the runtime user read access to its environment and write
access only to its own uploads/runtime cache.

Clone from GitHub, install the lockfile, and apply migrations using this app's
connection:

```sh
git clone https://github.com/rianhasansiam/europe-products.git RELEASE_DIRECTORY
cd RELEASE_DIRECTORY
npm ci
npx prisma migrate deploy
npm run typecheck
npm run build
```

Run builds with bounded CPU/memory and low scheduling priority on a shared host.
No global package upgrade, existing application restart, reboot, existing
translation worker change or shared database reset is required.

## Production environment

Use [.env.example](../.env.example) as the supported inventory. At minimum:

- `NODE_ENV=production`
- New, app-scoped `DATABASE_URL` and independently generated `AUTH_SECRET`
- `SITE_URL`, `NEXT_PUBLIC_SITE_URL`, `AUTH_URL`: `https://sextoybd.net`
- `UPLOAD_STORAGE=filesystem`, dedicated `UPLOAD_DIR` and new `UPLOAD_PUBLIC_URL`
- `AIRWALLEX_ENABLED=false` until scoped credentials and dashboard URLs are
  configured and sandbox payment checks pass

Do not ship development callback overrides. Optional credentials may remain blank.
Bundled translations do not require deploying a translation engine.

Fresh installations have no product or administrator seed. Register the owner's
real account before an authorized administrator promotion. Catalog prices and
shipping/discount amounts are used directly in USD without a manual price-review
approval; see [USD pricing](usd-pricing-migration.md). Historical amounts and
their saved currencies remain unchanged.

## Service and proxy

Run `next start --hostname 127.0.0.1 --port 3002` under the dedicated user. Use
systemd restart-on-failure, a read-only system, private temporary directory,
resource limits and narrow writable paths for this release's `.next` and uploads.
Keep credentials out of the unit and command line; use its protected environment.

Add only a new Nginx virtual host for `sextoybd.net`/`www.sextoybd.net` with:

- A dedicated ACME challenge webroot.
- `/uploads/` mapped to the app's persistent upload directory.
- App Router proxying to the isolated loopback listener with buffering disabled.
- Standard trusted proxy headers and a multipart upload limit.

Run `nginx -t` before a graceful reload. Do not modify other virtual hosts or
restart their applications. Record and compare existing process identities,
restart counters, virtual-host hashes and HTTP responses before/after deployment.

Point DNS A records for both hostnames to the deployment VPS and remove any
conflicting AAAA records. Issue a real certificate only after DNS reaches this
host; prefer `certbot certonly --webroot` for the dedicated challenge path.
Enable HTTPS/canonical redirects for this host after certificate verification.
Do not install an unrelated certificate or a self-signed substitute.

The previous canonical `sextoybd.com` origin is historical. If it remains under
the same ownership, retain its valid certificate and redirect old links and
payment returns to `https://sextoybd.net`, preserving paths and query strings.
Audit stored absolute upload URLs before retiring the old upload hostname.

Configure Google OAuth and Airwallex callbacks on the new domain. Payment keys
must belong to this app/provider account and remain disabled until verified.
See [Airwallex configuration](airwallex.md). A repository build does not prove
payment settlement, external dashboard setup or DNS/TLS readiness.
