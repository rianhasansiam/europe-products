# Native local multilingual development

This phase runs only on the development machine. LibreTranslate is installed from its official Python package in a dedicated virtual environment; no container tools are needed. Do not run `npm run db:tunnel`, connect to the VPS, or apply migrations using a production database URL.

## Detected machine and prerequisites

The inspected machine is macOS 26.6.2 / Darwin 25.6.0 on ARM64, with ten CPU cores and 16 GiB RAM. Its existing `/usr/bin/python3` is Python 3.9.6. Native installation uses the separately installed Homebrew Python 3.11.17 interpreter and does not alter system Python. The selected official LibreTranslate release is 1.9.6. Binary dependencies are resolved for Python 3.11/macOS ARM64 and pinned in `tools/libretranslate/requirements-macos-arm64-py311.lock`; the lock must not be assumed compatible with another operating system or architecture.

Use the repository's Node/npm versions (`Next.js 16.2.12`, `Node.js >=20.9.0`) and install application dependencies with `npm ci`. Initial Python dependency and model downloads require internet access and sufficient disk space. Platform, installed interpreters, CPU, RAM and ports were inspected before installation. The native scripts validate the interpreter and platform lock, and check the selected port before starting; package dependencies go only into their dedicated venv. Homebrew supplied Python's native dependencies (OpenSSL, XZ, mpdecimal and CA certificates); the translation runtime's native libraries resolved as compatible wheels.

Port 5000 was occupied by the macOS Control Center/AirPlay system service. It was not stopped or reconfigured. The native scripts therefore use **`http://127.0.0.1:5001`** and verify that their chosen port is free. Their bind address is always `127.0.0.1`, never a LAN address. The TypeScript provider and native scripts now default to port 5001. Export the native URL explicitly for the application, CLI and worker to override any old local environment settings.

If Python 3.11 is missing on this Mac:

```sh
brew install python@3.11
```

This installs a separate interpreter; it does not globally install LibreTranslate or change `/usr/bin/python3`. The scripts also accept an explicitly selected compatible interpreter. A future Linux setup must use its own verified wheel-compatible interpreter and lock, as described in [isolated deployment guide](deployment.md).

## Install, start, verify and stop

From the repository root, install the pinned environment and initially required English/Bengali models:

```sh
scripts/translation/install-local.sh --python "$(brew --prefix python@3.11)/bin/python3.11"
scripts/translation/start-local.sh --port 5001
scripts/translation/verify-local.sh
```

The installer creates `tools/libretranslate/.venv`, uses the committed platform-specific dependency lock with required SHA256 hashes for all 62 distributions, and checks `pip check`. Locked pip 26.2.1, setuptools 84.0.0 and wheel 0.45.1 bootstrap source builds without installing unpinned isolated build dependencies. English/Bengali match the currently published interface languages. The existing French catalog draft remains available for human review, but no French model is installed merely because the draft exists.

Persistent state lives beneath `tools/libretranslate/state/`: `data/` holds Argos packages, `cache/` holds MiniSBD sentence models, and `config/`, `run/` and `logs/` hold local service state. These paths and all virtual environments are ignored by Git. The child process receives private XDG paths and `ARGOS_DEVICE_TYPE=cpu`, with one Argos inter-thread and two intra-threads. The helper also explicitly directs MiniSBD to its private cache because that library's macOS default ignores XDG cache paths. Bengali uses the pinned `hi` sentence-segmentation file through the official mapping; no Hindi translation model is installed. Model caches are not shared with unrelated applications. Keep both translation packages and sentence-boundary caches when backing up or updating. Starting a service does not erase models or approve website catalogs.

Start is idempotent for the exact managed process, refuses occupied ports, and waits for both readiness and real directed pairs. Stop validates the recorded process identity before sending a signal; it does not terminate another program merely because it owns the port. Inspect logs beneath the ignored state directory if initialization fails. Stop without deleting the venv or models:

```sh
scripts/translation/stop-local.sh
```

Restart with the same `start-local.sh --port 5001` command. Changing ports requires stopping the existing managed instance first and updating the app's `LIBRETRANSLATE_URL`. All wrappers support `--help`; `LT_PYTHON`, `LT_PORT`, `LT_LANGUAGES`, and `LT_START_TIMEOUT` are repository-script settings, not invented upstream LibreTranslate options. `start-local.sh --foreground` is available for a supervisor and records ownership for install/model/stop guards. Stop a supervised service through its supervisor before package or model writes.

For a manual public-sample check while the service is running:

```sh
curl --fail --max-time 10 http://127.0.0.1:5001/health
curl --fail --max-time 10 http://127.0.0.1:5001/languages
curl --fail --max-time 120 http://127.0.0.1:5001/translate \
  -H 'Content-Type: application/json' \
  --data '{"q":["Hello world!","Add to cart"],"source":"en","target":"bn","format":"text"}'
```

`/health` must report `{"status":"ok"}`. English→Bengali requires the `en` row's `targets` to include `bn`; reverse support requires `en` in the `bn` row. Language names alone prove neither direction. Arrays return `translatedText` arrays in the same order. [Official v1.9.6 API implementation](https://github.com/LibreTranslate/LibreTranslate/blob/v1.9.6/libretranslate/app.py).

## Dedicated local database and application environment

Use a separate local PostgreSQL database, never the project's production SSH tunnel at port 15432. PostgreSQL 18 was already installed through Homebrew on this machine. To create a disposable empty cluster on an unused loopback port:

```sh
TASK_TRANSLATION_PG_BIN="$(brew --prefix postgresql@18)/bin"
TASK_TRANSLATION_PG_DIR="$(mktemp -d /tmp/bangbuy-translation-pg.XXXXXX)"
"$TASK_TRANSLATION_PG_BIN/initdb" -D "$TASK_TRANSLATION_PG_DIR" -U bangbuy_local --auth=trust --encoding=UTF8 --no-locale
"$TASK_TRANSLATION_PG_BIN/pg_ctl" -D "$TASK_TRANSLATION_PG_DIR" -l "$TASK_TRANSLATION_PG_DIR/server.log" -o '-p 55439 -h 127.0.0.1 -k /tmp' start
"$TASK_TRANSLATION_PG_BIN/createdb" -h 127.0.0.1 -p 55439 -U bangbuy_local bangbuy_translation_local
export DATABASE_URL='postgresql://bangbuy_local@127.0.0.1:55439/bangbuy_translation_local'
export DIRECT_URL="$DATABASE_URL"
```

The already prepared isolated test database uses port 55439 and database `bangbuy_translation_local`. Reuse its explicit URL if that cluster is running rather than creating another cluster on the occupied port. Trust authentication here is confined to an empty loopback test cluster. Stop a cluster you created with `"$TASK_TRANSLATION_PG_BIN/pg_ctl" -D "$TASK_TRANSLATION_PG_DIR" stop`.

The translation CLI loads root `.env` and `.env.local`, preserving existing shell variables. Prisma config loads `.env`; explicitly exporting local database settings is necessary before database commands when root `.env` still points to production. `DIRECT_URL` takes precedence for migrations. Check host/port without printing credentials and do not run a database reset.

```sh
npx prisma migrate deploy
npx prisma generate
```

The existing multilingual migration adds preferences, locale metadata, content translations and jobs. The additional translation-pair migration adds `LocaleLanguage.providerTargets` JSONB without deleting content or approved translations.

`tools/libretranslate/.env.example` provides script settings and the server URL. Add the following server-only application settings to an untracked root `.env.local`, preserving existing app settings; export the URL explicitly for commands:

```dotenv
LIBRETRANSLATE_URL=http://127.0.0.1:5001
LIBRETRANSLATE_API_KEY=
LIBRETRANSLATE_TIMEOUT_MS=60000
LIBRETRANSLATE_MAX_CHARACTERS=5000
LIBRETRANSLATE_BATCH_SIZE=20
TRANSLATION_BATCH_LIMIT=25
TRANSLATION_CHARACTER_LIMIT=50000
TRANSLATION_CONCURRENCY=1
TRANSLATION_PROTECTED_TERMS=SexToy
```

```sh
export LIBRETRANSLATE_URL=http://127.0.0.1:5001
npm run i18n:translations -- probe --source en --target bn --text 'Add to cart'
npm run i18n:translations -- sync-provider
npm run i18n:translations -- status
npm run i18n:translations -- audit
```

The URL and optional key stay server-only; do not use `NEXT_PUBLIC_*`. Optional API keys work only if enforcement is separately configured on the native service. The loopback setup does not need one. Keep request settings within the native service's 5,000-character/20-string limits. Stored capability refresh does not publish a locale and cannot disable existing reviewed catalogs.

## European language availability and selected models

Actual available pairs come from the running native service, not the registry or downloaded package index. Initially selected models are English↔Bengali. All target European languages have registry entries with canonical code, English/native name, direction and separate availability, completeness/review and publication state. Existing English/Bengali catalogs are published; the French draft and all other unprepared locales remain unpublished. No European reference document was found in this repository.

The freshly downloaded official index contained 100 packages. Both English directions were checked for all 28 target-language candidates: French (`fr`), German (`de`), Spanish (`es`), Italian (`it`), Portuguese (`pt`), Dutch (`nl`), Polish (`pl`), Czech (`cs`), Slovak (`sk`), Hungarian (`hu`), Romanian (`ro`), Bulgarian (`bg`), Slovenian (`sl`), Albanian (`sq`), Greek (`el`), Turkish (`tr`), Swedish (`sv`), Norwegian Bokmål (`nb`), Danish (`da`), Finnish (`fi`), Estonian (`et`), Latvian (`lv`), Lithuanian (`lt`), Ukrainian (`uk`), Russian (`ru`), Catalan (`ca`), Irish (`ga`) and Azerbaijani (`az`). Azerbaijani packages are version 1.5. These are download candidates; they are not installed native pairs. Consult the exact index and `/languages` before planning generation. [Official supported-model guide](https://docs.libretranslate.com/guides/supported_languages/).

The same actual index has no English pair for Croatian (`hr`), Serbian (`sr`/`sr-Latn`), Bosnian (`bs`), Belarusian (`be`), Maltese (`mt`), Icelandic (`is`), Luxembourgish (`lb`), Macedonian (`mk`), Georgian (`ka`), Armenian (`hy`) or Norwegian Nynorsk (`nn`). They remain manually importable; a future compatible open-source model can use the existing provider interface. The generic Norwegian visitor locale `no` maps explicitly to the Bokmål model `nb` while retaining its distinct visitor/catalog identity. Portuguese `pt-PT` uses the `pt` model; Brazilian Portuguese `pt-BR` remains distinct. [Official model guide](https://docs.libretranslate.com/guides/supported_languages/), [v1.9.6 API language mappings](https://github.com/LibreTranslate/LibreTranslate/blob/v1.9.6/libretranslate/language.py).

Install only models needed for a language being prepared. The committed `models.lock.json` currently permits only the English↔Bengali 1.9 archives and MiniSBD en/hi sentence files, all pinned by SHA256. To add French or another candidate, first review the exact official package versions and archive/sentence hashes and add those pins to the model lock. Without those reviewed pins, `--languages en,bn,fr` intentionally fails rather than downloading an arbitrary latest model. After that explicit lock change, stop the service, install selected pairs, restart, inspect capabilities and refresh the local database:

```sh
scripts/translation/stop-local.sh
scripts/translation/install-models.sh --languages en,bn,fr
scripts/translation/start-local.sh --port 5001
scripts/translation/verify-local.sh
npm run i18n:translations -- sync-provider
```

Selecting a language is not publication. Preserve the model manifest and package versions for reproducibility; model downloads are separate from Python dependency pins. Do not automatically update every language on each start. The model manager uses the official Argos package interface included with LibreTranslate, rather than an undocumented downloader. [Official Argos package API](https://github.com/argosopentech/argos-translate/blob/master/argostranslate/package.py).

## Catalog and content workflows

Static generation is explicit and never occurs during rendering. Use a supported installed target; the French example first requires its deliberately selected model above:

```sh
npm run i18n:translations -- generate --locale fr
npm run i18n:translations -- generate --locale fr --execute --max-characters 150000 --output translations/fr.json
npm run i18n:translations -- validate --locale fr --file translations/fr.json
```

Human review is required before the following import/publication commands. `validate --locale fr` reports unchanged meaningful messages by key. Review shared words/names individually before acknowledging them; the flag does not create missing translations or prove linguistic accuracy.

```sh
npm run i18n:translations -- import --locale fr --name French --native-name Français --file translations/fr.json --reviewed --reviewer local-reviewer --acknowledge-unchanged
npm run i18n:translations -- publish --locale fr --reviewer local-reviewer
```

Catalog validation protects ICU variables, plurals, rich tags, URLs, numbers, terms and completeness. All-English placeholder foreign catalogs cannot be published. Important legal text retains its original English language until separately reviewed. Existing `translations/drafts/fr.json` is preserved unpublished and requires review rather than regeneration to demonstrate the native install.

Dynamic content is queued only from approved public fields. Use an existing local public entity identifier in a batch JSON file:

```json
{
  "entityType": "product",
  "entityIds": ["replace-with-local-public-product-id"],
  "fields": ["name", "description", "descriptionBlocks", "seoTitle", "metaDescription"],
  "sourceLocale": "en",
  "targetLocale": "bn"
}
```

```sh
npm run i18n:translations -- batch --file translations/batch.json
npm run i18n:translations -- batch --file translations/batch.json --execute
npm run i18n:translations -- run --limit 5 --reviewer local-reviewer
npm run i18n:translations -- worker --limit 5 --interval 5000 --reviewer local-reviewer
```

The first command previews; the next queues; the worker runs separately from page rendering. Ctrl-C stops polling gracefully; `--cycles 1` performs one bounded cycle. Review and publish machine drafts in the existing `/en/admin/translations` panel. Approved/manual overrides are protected, canonical data is unchanged, and source hashes prevent stale content from being served. Private customer/authentication/employee information and financial fields never enter the translation allowlist.

## Safe dependency updates

Do not run `pip install --upgrade` inside the active environment. Prepare a reviewed full lock, then stage a separate environment:

```sh
scripts/translation/update-local.sh --python "$(brew --prefix python@3.11)/bin/python3.11" --lock tools/libretranslate/requirements-macos-arm64-py311.lock
# The running process keeps its existing interpreter until deliberately restarted:
scripts/translation/stop-local.sh
scripts/translation/start-local.sh --port 5001
scripts/translation/verify-local.sh
# If verification fails, select the retained previous environment and restart:
scripts/translation/update-local.sh --rollback
scripts/translation/stop-local.sh
scripts/translation/start-local.sh --port 5001
scripts/translation/verify-local.sh
```

Updates create an immutable `.venvs/<lock-hash>-<unique-id>` path, validate hash-pinned dependencies and a real translation before selecting it in ignored `runtime.json`, and retain the previous environment for rollback. The initial `.venv` is preserved. Current release/API validation requires `libretranslate==1.9.6`; changing the release needs a reviewed compatibility/code change, not a silent lock edit. Lifecycle mutation commands refuse to alter an actively serving environment or models. Reverting Python packages alone does not revert model packages: preserve both model-data and sentence-cache directories and their recorded versions before changing models.

No dependency version, credential or local absolute interpreter path should be silently substituted into committed files. A different platform requires its own tested lock. See the future native VPS runbook for system supervision, capacity, backups and rollback prerequisites.

## Verify the application

With the explicit local database and port-5001 URL exported:

```sh
npm run lint
npm run typecheck
npm test
RUN_LOCAL_TRANSLATION_INTEGRATION=1 LIBRETRANSLATE_URL=http://127.0.0.1:5001 npx vitest run __tests__/translation-local.integration.test.ts
npm run i18n:validate
npm run build
npm run dev -- --hostname 127.0.0.1
```

First visits must use English even when the browser prefers another language. Test selecting Bengali and English, refreshing, explicit locale URLs, login/cart retention, admin authorization, stored dynamic content, localized metadata/hreflang/sitemap and RTL layout. Stop the native translator and verify public pages still render stored translations promptly; restart it afterward. No order, payment or third-party message is needed for these checks.

On 13 October 2026 the native venv reported Python 3.11.17, LibreTranslate 1.9.6 and a clean `pip check`. Hash validation passed for both English↔Bengali 1.9 model archives and en/hi sentence files. Actual `/languages` returned `en` and `bn`, both advertising targets `bn,en`; `Hello world!` translated to `হ্যালো বিশ্ব!`. The Python process listened only on `127.0.0.1:5001`. Fresh staged install/activation/rollback, foreground ownership guards, graceful stop/restart and rejection of occupied port 5000 all passed; Control Center remained untouched.

With the native service physically stopped, English/Bengali contact, product, cart and checkout page samples still returned HTTP 200 in 0.009–0.02 seconds. The native service was restored. Full verification results are recorded in [translation-architecture.md](translation-architecture.md). No VPS setup or deployment occurred.
