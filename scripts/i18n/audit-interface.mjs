/** Read-only inventory. Catalog expansion uses scripts/translations.ts; this never rewrites source files. */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const roots = ["app", "components", "lib/airwallex/components"];
const fragments = ["core", "interface", "admin", "translation-management", "seo", "notifications"];
const sourceOnly = new Set([
  "app/(shop)/privacy-policy/page.tsx",
  "app/(shop)/return-policy/page.tsx",
  "app/(shop)/terms-and-conditions/page.tsx",
  "components/policy/PolicyHero.tsx",
  "components/policy/PolicyContactBlock.tsx",
]);
const protectedText = new Set(["Bang", "Buy", "SexToy", "CN", "QC", "GTIN", "HQ", "P", "H"]);
const publicAttributes = new Set(["aria-label", "alt", "label", "title", "message", "description", "placeholder", "headlineLead", "headlineEmphasis", "subheading", "badgeText"]);
const files = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith(".tsx")) files.push(file);
  }
}
roots.forEach(walk);
const inventory = [];
const staticCandidates = [];
for (const file of files.sort()) {
  const code = readFileSync(file, "utf8");
  const document = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const namespaces = new Set();
  let sourceCalls = 0;
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(document);
      if (["useInterfaceTranslations", "getInterfaceTranslations", "useTranslations", "getTranslations"].includes(callee)) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteral(argument)) namespaces.add(argument.text);
      }
      if (callee === "i18n" || callee === "i18n.rich") sourceCalls++;
    }
    if (!sourceOnly.has(file)) {
      if (ts.isJsxText(node)) {
        const text = node.text.replace(/\s+/g, " ").trim();
        if (/[A-Za-z]/.test(text) && !protectedText.has(text)) {
          staticCandidates.push({ file, line: document.getLineAndCharacterOfPosition(node.pos).line + 1, text });
        }
      }
      if (ts.isJsxAttribute(node) && publicAttributes.has(node.name.getText(document)) && node.initializer && ts.isStringLiteral(node.initializer)) {
        const text = node.initializer.text;
        const translatedConsumer = ts.isJsxSelfClosingElement(node.parent.parent) && node.parent.parent.tagName.getText(document) === "SectionFallback";
        if (/[A-Za-z]/.test(text) && !protectedText.has(text) && !/^(?:https?:|\w+@)/.test(text) && !translatedConsumer) {
          staticCandidates.push({ file, line: document.getLineAndCharacterOfPosition(node.pos).line + 1, attribute: node.name.getText(document), text });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(document);
  inventory.push({ file, namespaces: [...namespaces], sourceCalls, sourceOnly: sourceOnly.has(file) });
}
function leaves(value) {
  return Object.values(value).flatMap((entry) => typeof entry === "string" ? [entry] : leaves(entry));
}
const catalogCounts = {};
for (const locale of ["en", "bn"]) {
  catalogCounts[locale] = Object.fromEntries(fragments.filter((fragment) => existsSync(`messages/${fragment}-${locale}.json`)).map((fragment) => [fragment, leaves(JSON.parse(readFileSync(`messages/${fragment}-${locale}.json`, "utf8"))).length]));
}
const report = {
  inventory,
  staticCandidates,
  catalogCounts,
  sourceOnlyDocuments: [...sourceOnly],
  notificationAudit: "Application-owned status notification templates use local structured catalogs; delivery is a log sink unless configured separately.",
  externalTemplateAudit: "Contact EmailJS email template is hosted externally and its template body is absent from the repository.",
  documentAudit: "Existing receipt/report PDFs retain their explicitly identified English document language; font embedding requires separate validated script support.",
  dynamicContentAudit: "Database product/category/brand/banner fields use stored allowlisted translations and source-language availability notices; private user fields stay intact.",
};
console.log(JSON.stringify(process.argv.includes("--json") ? report : { filesAudited: inventory.length, catalogCounts, staticCandidates, sourceOnlyDocuments: report.sourceOnlyDocuments }, null, 2));
