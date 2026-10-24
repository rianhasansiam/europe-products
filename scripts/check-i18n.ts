import { readFileSync, writeFileSync } from "node:fs";
import { validateCatalog, flattenCatalog, validateMessage } from "../lib/translations/validation";

const fragments = ["core", "interface", "admin", "translation-management", "seo", "notifications"];
export function readCatalog(locale: string): Record<string, unknown> {
  return Object.assign({}, ...fragments.map((fragment) => JSON.parse(readFileSync(`messages/${fragment}-${locale}.json`, "utf8"))));
}

const source = readCatalog("en");
const english = flattenCatalog(source);
for (const [key, message] of Object.entries(english)) {
  validateMessage(message, message);
  if (/[\u0980-\u09ff\u0600-\u06ff]/u.test(message)) throw new Error(`English catalog contains non-English source text: ${key}`);
}
const target = readCatalog("bn");
const result = validateCatalog(source, target);
console.log(JSON.stringify({ sourceLocale: "en", preparedLocales: ["en", "bn"], requiredMessagesPerLocale: result.messages, sourceHash: result.hash }, null, 2));
if (process.argv.includes("--publish-bundled")) {
  writeFileSync("lib/i18n/published.json", JSON.stringify({ locales: ["en", "bn"] }, null, 2) + "\n");
  console.log("Published validated bundled English and Bengali interface catalogs. Legal documents remain English until reviewed.");
}
