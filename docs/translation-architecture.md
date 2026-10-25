# Multilingual architecture and local implementation record

This implementation uses the official LibreTranslate Python package in a dedicated native virtual environment as the only automatic translation engine. No container runtime or container-based dependency is required. Work and verification are local. The production VPS, production database, SSH tunnel, uploads, payment providers and production services were not accessed or changed.

## Project inspection and preserved infrastructure

The inspected runtime uses Node.js 26.8.1 and npm 11.19.0. The application uses Next.js 16.2.12 App Router and `proxy.ts`, React 19.2.4, next-intl 4.14.9, Prisma 7.9.1/PostgreSQL, Auth.js v5 credentials/Google OAuth, Redux cart/wishlist state, Zod validation, Tailwind 4, Airwallex. Relevant installed Next.js guides were read before changes. There is an existing protected admin panel and additive translation schema/workflow.

The existing implementation separates internationalization (`lib/i18n`, structured message catalogs, locale navigation and preferences) from automatic translation (`lib/translations/provider.ts`). Its former engine was Google Cloud Advanced v3 via `google-auth-library`; no other automatic translator SDK or scraper was found. Google OAuth and unrelated Google services remain intact. Existing working English/Bengali translations, preferences, SEO prefixes and database records were preserved.

The native implementation plan retains the existing server adapter, i18n and data. It inspects the actual platform and available ports, resolves a pinned official Python package in an isolated Python 3.11 venv, installs only English/Bengali models for initially published languages, binds the native service to loopback, then verifies real directed pairs and existing stored jobs/routes/SEO/business behavior. Native scripts and a future VPS runbook replace the previous incompatible infrastructure. No unrelated feature is rebuilt.

## Runtime and generation paths

`lib/i18n/registry.ts` centralizes BCP 47 codes, English/native names, direction, provider mappings and bundled catalog publication. Locale database rows add catalog completeness, review/publication status and actual outgoing provider pairs. English is the default; browser language, IP, country and geolocation never choose another language. An explicit locale URL takes precedence over the saved HttpOnly cookie/account preference. Manual switching preserves equivalent path, query and fragment; existing tab-local safe-draft recovery and submission guards remain. Sensitive or unsupported unsaved fields require the existing explicit leave decision rather than being silently stored.

Existing canonical prefixes remain: `/products` selects English and redirects to `/en/products` for a first visitor. `/bn/products` explicitly selects Bengali. Unsupported/disabled locales redirect to the equivalent English URL. English stays selectable and cannot be disabled. `skipProxyUrlNormalize` and raw-request-origin rewrites prevent Next.js loopback hostname normalization from turning internal locale rewrites into external self-requests.

Rendering uses only bundled or persisted reviewed catalogs and stored content. It never requests LibreTranslate. Publication and active catalogs have bounded server caches; source/context hashes invalidate stored content. Missing content is explicitly labelled with its actual source language and an availability notice. Pages without complete translated primary content do not advertise that language as ready for SEO.

Static generation runs through explicit CLI commands. ICU literal spans are translated while placeholders, branch structure, rich tags, brand/model/SKU terms, URLs, numbers and protected terminology stay local. Output is structurally validated and remains an unpublished draft until human review/import/publication. The protected-span strategy was verified after a real Argos model changed opaque placeholder markers. It may reduce sentence context around protected terms; linguistic review remains necessary.

Dynamic translation uses only approved public product/category/brand/manufacturer/banner fields. Private customer/authentication data and financial fields are excluded. Unique revision/context/source/target job keys deduplicate queue writes. Controlled workers apply bounded concurrency, timeouts, renewed ownership leases, backoff, explicit failed-job recovery, failure tracking and source checks before and after translation. Originals remain untouched. Admin review checks the current source and translation versions to reject approval from an obsolete editor snapshot. Explicitly approved/manual wording is protected; stale unreviewed machine drafts can regenerate. The protected admin interface manages registry publication, coverage, catalog import/export, manual edits, approval, batches and failed jobs through existing administrator authorization and origin/body limits.

## Native runtime and actual language availability

The inspected machine is macOS 26.6.2 / Darwin 25.6.0, ARM64, ten CPU cores and 16 GiB RAM. System Python `/usr/bin/python3` is 3.9.6 and remains unchanged. Native installation selects the separate Homebrew Python 3.11.17 interpreter and official LibreTranslate 1.9.6 package. Its platform-specific fully pinned dependency manifest is `tools/libretranslate/requirements-macos-arm64-py311.lock`; all Python packages live in the dedicated venv, with separate persistent Argos and MiniSBD cache paths beneath ignored local state.

Port 5000 is occupied by macOS Control Center/AirPlay. That unrelated system service is retained. Native scripts use `http://127.0.0.1:5001` and reject occupied ports. The TypeScript provider and native scripts now share the port-5001 default. Native app/worker/CLI commands still explicitly set `LIBRETRANSLATE_URL=http://127.0.0.1:5001` to override legacy environment values. The scripts always bind to `127.0.0.1` and never expose the translator over the local network.

The installed models are English↔Bengali, matching existing published interface catalogs. Both Argos archives are version 1.9 and SHA256-pinned in `models.lock.json`; MiniSBD sentence files `en` and `hi` have their own hashes. The official Bengali segmentation mapping uses `hi`; that does not install Hindi translation. Actual native `/languages` returned source `en` with targets `bn,en`, and source `bn` with targets `bn,en`. English→Bengali sample `Hello world!` returned `হ্যালো বিশ্ব!`. Only exact outgoing targets establish enabled pairs; an installed catalog does not imply an installed model.

`translations/drafts/fr.json` contains the preserved 2,895-message French interface draft, imported unreviewed into the isolated local database in the earlier provider phase. It remains unpublished. Its 94 meaningful unchanged messages require individual review and explicit acknowledgement before approval. French is no longer an initially installed model: preserving its data does not enable native French generation. All other European languages are currently manual/import-only or require selected model installation and complete catalog review. Model candidates and absent official pairs are distinguished in [the local guide](translation-local-setup.md). No European reference document was found in the inspected repository.

Regional/script identity is preserved: Portuguese/Portugal/Brazil and Chinese Simplified/Traditional remain distinct visitor locales. Provider aliases describe model reuse, never human review or publication. The requested Macedonian, Georgian, Armenian and Azerbaijani entries already exist in the central registry; Azerbaijani has an official English-pair download candidate, while the other three do not appear in the inspected official model guide. Manual catalog import remains available for valid unsupported locales. [Official model guide](https://docs.libretranslate.com/guides/supported_languages/).

## Database changes

The preserved `20261012000000_multilingual` migration adds `User.preferredLocale`, `LocaleLanguage`, `ContentTranslation` and `TranslationJob`, without altering canonical content or financial records. The new `20261012001000_libretranslate_pairs` migration adds nullable `LocaleLanguage.providerTargets` JSONB. Legacy provider rows with unknown pairs fail closed for machine generation until refreshed. Stored translations are retained.

All fourteen migrations were applied successfully to a new isolated PostgreSQL 18 database at `127.0.0.1:55439/bangbuy_translation_local`. The project's existing loopback port 15432 reaches a production SSH tunnel and was explicitly excluded. Prisma schema validation and client generation also used explicit local URLs.

For an existing dedicated local database:

```sh
export DATABASE_URL='postgresql://LOCAL_USER:LOCAL_PASSWORD@127.0.0.1:5432/bangbuy_translation_local'
export DIRECT_URL="$DATABASE_URL"
npx prisma migrate deploy
npx prisma generate
```

Do not copy those placeholder credentials literally. The exact isolated PostgreSQL instance used for testing has no production data.

## Changed and created files

| Files | Preserved translation work and native conversion |
| --- | --- |
| `lib/translations/provider.ts` | Replaced Google adapter with the official LibreTranslate server adapter, exact pairs, health, sanitized errors, bounded requests/cache |
| `lib/translations/service.ts`, `languages.ts` | Transactional capability snapshots, pair validation, protected approvals, bounded regeneration/retries and language dashboard |
| `lib/translations/content.ts`, `protection.ts`, `catalog-generation.ts`, `validation.ts` | Protected local text spans, long-text batching, ICU/catalog/structured-content safety |
| `lib/i18n/registry.ts` | European language/native-name registry and explicit regional mappings without publishing incomplete locales |
| `prisma/schema.prisma`, new pair migration | Persist exact outgoing provider targets additively |
| `scripts/translations.ts` | LibreTranslate generation, live `probe`, bounded queue worker and existing operator workflows |
| `app/admin/translations/TranslationsManager.tsx`, management catalogs | Provider/setup, directed availability and retry workflow labels |
| `proxy.ts`, `next.config.ts` | Preserve loopback rewrite origin while retaining locale routing |
| `components/layout/Navbar.tsx`, `__tests__/rtl-layout.test.ts` | RTL positioning/direction, translated desktop search and actual shared-header layout fixtures |
| `package.json`, `package-lock.json` | Removed translation-only Google authentication dependency; next-intl retained |
| `scripts/translation/*.sh`, `tools/libretranslate/native.py` | Native install/model/start/stop/verify/update lifecycle; platform and occupied-port checks; managed process identity |
| `tools/libretranslate/requirements.in`, `requirements-macos-arm64-py311.lock`, `models.lock.json`, `.env.example` | Reviewed inputs, hash-pinned 62-package Python environment, model/sentence pins and native local defaults |
| `tools/libretranslate/test_native.py`, `.gitignore`, `eslint.config.mjs` | Native lifecycle guards/tests; local venv/model/state ignored by Git and excluded from application lint |
| Previous `infra/translation/*` and VPS deployment runbook | Incompatible setup removed and replaced by native scripts and `docs/deployment.md`; useful translation data retained |
| `docs/i18n.md`, `docs/translation-*.md`, `README.md` | Updated architecture, removal record, local commands, future deployment prerequisites and verification |
| `translations/drafts/fr.json` | Complete generated French interface draft, unpublished and awaiting review |
| Translation/locale/provider tests | Deterministic and opt-in real local integration coverage; corrected existing provider test expectations and React provider test typing |

The working tree already contained extensive uncommitted localization and LibreTranslate integration changes before the native phase. Those changes were preserved. The table includes that existing translation implementation and the native conversion; the latter adds the Python lifecycle, dependency/model locks, runtime exclusions and documentation, and aligns the provider default and real integration checks with native port 5001 and Bengali models.

## Removed integrations

- `GoogleTranslationProvider`, its Advanced v3 API request/authentication/glossary code and defaults.
- `google-auth-library` direct dependency and its now-unused transitive dependency entries, using npm to update the lockfile.
- Active translation references to `GOOGLE_CLOUD_PROJECT`, `GOOGLE_TRANSLATION_LOCATION`, `GOOGLE_TRANSLATION_GLOSSARY` and `GOOGLE_APPLICATION_CREDENTIALS`.
- Superseded Google setup messages, CLI constructors and documentation requirements for billing/IAM/service-account translation credentials.

There was no standalone Google translation route to remove. Unrelated OAuth, fonts, maps, analytics and payments were retained. Provider removal followed passing local LibreTranslate provider/workflow tests and real persisted translation verification.

## Local commands and environment

From the repository root, use the separately installed Python 3.11 interpreter:

```sh
scripts/translation/install-local.sh --python "$(brew --prefix python@3.11)/bin/python3.11"
scripts/translation/start-local.sh --port 5001
scripts/translation/verify-local.sh
export LIBRETRANSLATE_URL=http://127.0.0.1:5001
npm run i18n:translations -- probe --source en --target bn --text 'Add to cart'
# Export dedicated local DATABASE_URL and DIRECT_URL before database commands:
npm run i18n:translations -- sync-provider
npm run i18n:translations -- status
npm run i18n:translations -- worker --reviewer local-operator --limit 5 --interval 5000
# Stop only the managed native translator, retaining packages and models:
scripts/translation/stop-local.sh
```

The worker is a separate background process; Ctrl-C stops it gracefully. `--cycles 1` performs one bounded polling cycle. Exact prerequisites, local PostgreSQL setup, catalog/import/batch commands, model management and safe updates are in [translation-local-setup.md](translation-local-setup.md). Real credentials and interpreter/state paths belong only in ignored local state/environment files.

| Application variable | Default/purpose |
| --- | --- |
| `LIBRETRANSLATE_URL` | `http://127.0.0.1:5001`, shared native/provider default; still export explicitly |
| `LIBRETRANSLATE_API_KEY` | Optional server-only key for separately configured enforcement |
| `LIBRETRANSLATE_TIMEOUT_MS` | `60000`, maximum `120000` per HTTP request |
| `LIBRETRANSLATE_MAX_CHARACTERS` | `5000` characters per HTTP request |
| `LIBRETRANSLATE_BATCH_SIZE` | `20` strings per HTTP request |
| `TRANSLATION_BATCH_LIMIT` | `25` jobs per controlled workload, maximum 100 |
| `TRANSLATION_CHARACTER_LIMIT` | `50000` source characters per workload, maximum 250000 |
| `TRANSLATION_CONCURRENCY` | `1` globally permitted running job, maximum 5 |
| `TRANSLATION_PROTECTED_TERMS` | Pipe-separated protected terminology, including SexToy |
| `DATABASE_URL`, `DIRECT_URL` | Existing app/Prisma settings; dedicated local values in this phase |
| `RUN_LOCAL_TRANSLATION_INTEGRATION` | Explicit opt-in `1` for real local PostgreSQL/native LibreTranslate tests |

`LT_PYTHON`, `LT_PORT`, `LT_LANGUAGES` and `LT_START_TIMEOUT` configure the repository's native lifecycle scripts. They are not claims that every such variable is an upstream LibreTranslate option. Native scripts invoke only flags inspected in the pinned release, keep XDG data/cache/config paths local, and restrict Argos to CPU execution. Python environment and model pins are separate: retain model version manifests and both caches for rollback. Native Argos is configured for one inter-thread and two intra-threads. Start validates pinned installed files and refuses network-driven model changes. The helper directs MiniSBD explicitly to its local cache because its macOS default ignores XDG paths.

## Translation caching strategy

Public rendering performs no translation HTTP requests. Valid reviewed database translations are stored once and batch-read using source/context hashes; canonical source changes invalidate obsolete results. Job uniqueness includes source revision, locale pair and protected-term context, preventing duplicate generation. Missing/stale drafts fall back to labelled original content. Approved/manual overrides require explicit human review rather than automatic overwrite.

Server caches hold publication/language metadata and only active catalogs: 30-second expiry, a maximum of eight active catalogs and explicit invalidation after management writes. A separate one-minute provider-capability cache coalesces `/languages` fetches. Transient metadata failures retain a last verified publication snapshot; a cold unknown failure exposes English only. This preserves administrator disables rather than guessing publication. A real local probe read the stored en/bn metadata twice with one PostgreSQL query, no HTTP call, and the same cached snapshot. The translation provider is independent from ordinary page availability.

## Verification and remaining limits

Fresh native and application checks on 13 October 2026 used only this Mac, the loopback translator and the explicitly isolated PostgreSQL database at port 55439:

| Check | Actual result |
| --- | --- |
| Dedicated interpreter/venv | CPython 3.11.17, LibreTranslate 1.9.6; system Python 3.9.6 unchanged |
| Reproducible native install | All 62 Python distributions SHA256-pinned; locked build tools, no unpinned isolated builds; `pip check` clean |
| Model pins and storage | English↔Bengali Argos 1.9 archive/installed-file hashes and MiniSBD en/hi hashes pass; both caches persistent and ignored |
| Native health, pair discovery and sample | `/health` status `ok`; en/bn each targets bn,en; `Hello world!` → `হ্যালো বিশ্ব!` |
| Native network boundary | Python listener only on `127.0.0.1:5001`; start on occupied 5000 refused; Control Center PID untouched |
| Update/rollback/ownership | Fresh candidate venv installed/tested, running interpreter retained until restart; original venv rollback selected successfully; foreground install/model-write guards reject mutations; graceful stop/restart passes |
| Native lifecycle unit checks | All 16 passed |
| `npm test -- --reporter=dot` | 1,173 passed, 14 intentionally skipped; 76 passing files and 2 skipped files |
| Real native local integration | All 3 passed against Bengali/native 5001/local PostgreSQL: category jobs/review/staleness/manual protection; all 5 public product fields/structured descriptions; outage stored reads |
| Metadata cache probe | Two reads, one PostgreSQL query, zero HTTP calls, same cached snapshot |
| RTL component/fixture tests | All 6 passed; actual Navbar/LanguageSelector and current built styles used for unpublished Arabic layout QA |
| `npm run typecheck` | Passed |
| `npm run build` | Passed on installed Next.js 16.2.12; all 56 static pages generated; no temporary QA routes included |
| `npm run lint` | 0 errors; 3 existing unused-variable warnings in About, CarouselBanner and API envelope |
| `npm run i18n:validate` | English/Bengali 2,895-message catalogs pass completeness, ICU branch/# and protected-literal checks |
| Preserved French draft validation | 2,895 messages pass; 2,799 changed meaningful messages and 94 shared/unchanged messages flagged for human review; unpublished |
| Interface inventory | 294 TSX files audited; remaining static candidates are SKU/currency identifiers and URL/slug examples |
| Prisma/migrations | Schema/client valid; all 14 migrations applied to isolated local database; migration status up to date |
| Source/dependency cleanup | No active Google translation SDK/obsolete env references; unrelated Google integrations retained; native runtime/model/env paths Git-ignored |

Actual fresh browser checks verified manual English→Bengali selection, refresh and return to unprefixed `/contact` retaining Bengali, administrator session retention and the native en/bn pair display/2,895-message coverage. French remained unreviewed with Publish disabled. A fresh request advertising `Accept-Language: fr-FR` still redirected to `/en/contact`; an explicit English locale URL takes precedence over the saved preference. Anonymous admin API access returned 401. Earlier actual local USER-session authorization returned 403; unchanged existing authorization also remains covered by route tests. Contact query/fragment and safe draft recovery were verified in the preserved prior i18n browser checks.

Historical Bengali contact HTML checks verified `lang="bn"`, `dir="ltr"`, the former canonical `https://sextoybd.com/bn/contact` and en/bn/x-default alternatives. The permanent canonical origin is now `https://sextoybd.net`; the earlier browser observations below are retained as historical evidence rather than a verification of the new deployment. Sitemap entries and redirects for unpublished French/unsupported Croatian were inspected in local responses. Incomplete variants cannot advertise ready translations.

The native process was physically stopped and confirmed unavailable. English/Bengali contact, product, cart and checkout page samples returned HTTP 200 in 0.009–0.02 seconds. The service was restarted and real readiness restored. Native logs were also checked with a unique public input marker: no input-text log bytes were emitted. No order, payment, contact message, external EmailJS notification or VPS operation was submitted.

Fresh Arabic layout QA used the actual shared header and current production styles at desktop width 1470 and mobile 390×844. The mobile drawer close/title, logical search padding and badges rendered correctly. The fixture had `lang="ar"`, `dir="rtl"` and no horizontal overflow (`scrollWidth` and viewport width both 390). It is a partial static QA catalog, not a complete published Arabic translation or hydrated preference test. The temporary loopback server was stopped, its browser tab closed and viewport override reset.

The running review preview is [http://127.0.0.1:3111/en/contact](http://127.0.0.1:3111/en/contact), using native port 5001 and the isolated local database at 55439. Final native serving uses the original dedicated `.venv` after successful candidate/rollback verification. Existing root environment files and the user's pre-existing development server are preserved. Export dedicated local database/translator variables before starting the app; root `.env` still contains production-tunnel settings. Initial venv/model storage measured approximately 345 MiB/297 MiB before retained candidate-update artifacts; these measurements are not a maximum resource guarantee.

Human linguistic/legal review cannot be established by structural tests or machine generation. New catalogs remain unpublished until reviewed. Original legal/contract pages explicitly retain English and non-English variants remain unindexed; their availability notice is translated. Existing PDFs retain explicit English because the current fonts do not support complex-script shaping. External EmailJS templates were neither changed nor sent. Search uses the canonical catalog rather than a separate translated search index. Prices, tax, order totals, payment rules, cart/login state and commerce calculations retain their existing implementation; the real native product integration preserved its price 2010, URLs, model/SKU identifiers, technical 220 V value and all canonical fields.

## Native requirement audit

| Objective item | Required evidence and scope |
| --- | --- |
| 1. Inspect existing project and plan | Dependency/routing/auth/schema/provider audit, platform inspection and concise retained-infrastructure plan above |
| 2. Remove obsolete translation providers | LibreTranslate-only server adapter/worker/CLI; translation-only Google SDK removal record; unrelated Google services, i18n and stored translations preserved |
| 3. Native install | Dedicated Python 3.11 venv, official pinned package/dependencies, isolated persistent caches, exact lifecycle scripts, interpreter/platform/port checks and actual native process/API evidence |
| 4. European registry/models | All requested code/name/native-name/direction entries; actual outgoing model pairs stored separately from catalog coverage and publication; manual imports and English fallback |
| 5. English default and selection | Routing/preference tests and actual browser/profile evidence; no automatic browser/IP locale, explicit URL precedence, refresh/navigation and cart/auth retention |
| 6. Server-only service | No browser requests/credentials or page-render translation; exact pair validation, HTTP timeout/sanitized failures, stored cache/revisions and bounded retrying workers |
| 7. Static/dynamic translation | 294-file UI inventory, complete validated 2,895-key English/Bengali catalogs; stored whitelisted public fields, source/context/status/timestamps, originals and manual approvals protected |
| 8. Performance/offline behavior | Stored-only rendering, bounded metadata/catalog caches and request/job limits, global concurrency, dedupe, three-attempt backoff and native-offline rendering evidence |
| 9. SEO/RTL/business invariants | Ready-only canonical/hreflang/x-default/sitemap/lang/dir; actual header RTL fixture plus component tests; financial values and order/payment calculations untouched |
| 10. Existing admin management | Existing design/current ADMIN guard with language publication/coverage, batches/job retries, version-checked manual edits/review, catalog import/export |
| 11. Local verification | Native installation/venv/health/pairs, actual persisted translation/cache/outage, default/preferences/routes/SEO/auth/checkout/RTL and fresh lint/type/tests/build outputs |
| 12. Native scripts/docs/VPS preparation | Requested install/start/verify wrappers plus stop/models/update; platform-specific pinned dependency lock; architecture/local guide/future native VPS setup; no incompatible infrastructure files or VPS action |
| 13. Final report | Architecture/file/removal inventory, Python/LibreTranslate versions, exact install/start/stop/API, model availability/cache strategy, migration commands, test/build results and VPS prerequisites in these linked documents |

The evidence above covers the native local definition of done. Registry inclusion is not a claim that every European language is machine-supported or published. New model preparation/catalog review and the VPS rollout remain explicit later actions; existing English/Bengali remain the only visitor catalogs published by this phase.

The future VPS phase needs a separately authorized server audit, a supported Python 3.11 interpreter, its own validated Linux/architecture dependency lock, enough memory/CPU/disk alongside existing apps, unprivileged service supervision, loopback-only API access for the existing Next.js server and worker, outbound access during model preparation, persistent Argos/MiniSBD data, application database backups/additive migrations, approved catalogs and reversible versioned environments/models. Follow [isolated deployment guide](deployment.md) only during that later authorized phase. This phase did not connect to or configure the VPS.
