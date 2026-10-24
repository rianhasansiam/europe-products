# Unpublished translation drafts

`fr.json` was generated locally using the pinned LibreTranslate v1.9.6 English → French model. It contains every current required interface message, including administrator, authentication, checkout, SEO and notification namespaces. It is not loaded by the website, marked reviewed, or published automatically.

Structural validation checks keys, ICU branches/placeholders, protected terminology, URLs and data values. Human linguistic review is still required. The current draft has 94 meaningful unchanged messages flagged for review; check shared French wording/proper names before acknowledging them. Short fragments around protected text may read awkwardly; correct those manually before import. Do not certify legal/privacy wording based only on machine generation or a passing validator.

From the repository root:

```sh
npm run i18n:translations -- validate --locale fr --file translations/drafts/fr.json
# Only after a responsible reviewer has reviewed the whole catalog:
npm run i18n:translations -- import --locale fr --name French --native-name Français --file translations/drafts/fr.json --reviewed --reviewer REVIEWER_ID --acknowledge-unchanged
npm run i18n:translations -- publish --locale fr --reviewer REVIEWER_ID
```

Use a dedicated local database during this phase. Dynamic product/category translations require their own source-specific review; a complete interface catalog alone does not establish localized SEO readiness for those pages.
