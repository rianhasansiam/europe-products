import { createHash } from "node:crypto";
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { getLocaleDefinition, normalizeLocale } from "@/lib/i18n/registry";
import { assertProtectedText, protectText } from "./protection";

export type MessageCatalog = Record<string, unknown>;

export function canonicalLocale(code: string): string {
  const locale=normalizeLocale(code);if(!locale)throw new Error("Invalid language code.");return locale;
}

export function localeDirection(code: string): "ltr" | "rtl" {
  return getLocaleDefinition(canonicalLocale(code)).direction;
}

export function providerLanguageCode(code: string): string {
  return getLocaleDefinition(canonicalLocale(code)).providerCode??canonicalLocale(code);
}

export function contentHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function flattenCatalog(catalog: MessageCatalog, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(catalog)) {
    if (!key || key.includes(".") || ["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Invalid message key.");
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result[path] = value;
    else if (value && typeof value === "object" && !Array.isArray(value)) Object.assign(result, flattenCatalog(value as MessageCatalog, path));
    else throw new Error(`Message ${path} must be a string or namespace.`);
  }
  return result;
}

function elementRule(element: MessageFormatElement): string {
  if (element.type === TYPE.pound) return "pound";
  if (element.type === TYPE.literal) return "literal";
  if (element.type === TYPE.plural) return JSON.stringify([element.type, element.value, element.pluralType, element.offset]);
  if (element.type === TYPE.number || element.type === TYPE.date || element.type === TYPE.time) {
    // Compare formatting meaning rather than skeleton token order. Currency,
    // unit and percentage options are part of the application contract.
    const style = element.style && typeof element.style === "object" ? { type: element.style.type, options: element.style.parsedOptions } : element.style ?? null;
    return JSON.stringify([element.type, element.value, style], (_key, value) => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))) : value);
  }
  return JSON.stringify([element.type, element.value]);
}

function rulesUsed(elements: MessageFormatElement[]): string[] {
  return elements.flatMap(element => {
    if (element.type === TYPE.literal) return [];
    const children = element.type === TYPE.tag ? rulesUsed(element.children)
      : element.type === TYPE.plural || element.type === TYPE.select ? Object.values(element.options).flatMap(option => rulesUsed(option.value)) : [];
    return [elementRule(element), ...children];
  });
}

function sameRules(source: MessageFormatElement[], target: MessageFormatElement[], terms: string[]): boolean {
  const literals = (elements: MessageFormatElement[]) => elements.filter(element => element.type === TYPE.literal).map(element => element.value).join(" ");
  try { assertProtectedText(literals(source), literals(target), terms); } catch { return false; }
  const from = source.filter(element => element.type !== TYPE.literal);
  const to = target.filter(element => element.type !== TYPE.literal);
  if (from.length !== to.length) return false;
  const compatible = (original: MessageFormatElement, translated: MessageFormatElement): boolean => {
    if (elementRule(original) !== elementRule(translated)) return false;
    if (original.type === TYPE.tag && translated.type === TYPE.tag) return sameRules(original.children, translated.children, terms);
    if ((original.type === TYPE.plural && translated.type === TYPE.plural) || (original.type === TYPE.select && translated.type === TYPE.select)) {
      const fixedOptions = (element: typeof original) => Object.keys(element.options).filter(option => element.type === TYPE.select || option.startsWith("=")).sort();
      if (JSON.stringify(fixedOptions(original)) !== JSON.stringify(fixedOptions(translated))) return false;
      // Keep each shared category's placeholders in that category. New CLDR
      // categories inherit the source fallback's contract. A language may omit
      // an English category such as `one`; the complete variable set is checked
      // separately so omission cannot hide a lost application variable.
      return Object.entries(translated.options).every(([option, branch]) => {
        const originalBranch = original.options[option] ?? original.options.other;
        return !!originalBranch && sameRules(originalBranch.value, branch.value, terms);
      });
    }
    return true;
  };
  // Word order may change. Match occurrences, rather than a deduplicated set,
  // so repeated variables or repeated selects cannot disappear. The matching
  // also permits reordering two independent ICU expressions for one variable.
  const candidates = from.map(original => to.map(translated => compatible(original, translated)));
  const owners = new Array<number>(to.length).fill(-1);
  const assign = (index: number, visited: Set<number>): boolean => {
    for (let targetIndex = 0; targetIndex < to.length; targetIndex++) {
      if (!candidates[index][targetIndex] || visited.has(targetIndex)) continue;
      visited.add(targetIndex);
      if (owners[targetIndex] === -1 || assign(owners[targetIndex], visited)) { owners[targetIndex] = index; return true; }
    }
    return false;
  };
  return from.every((_, index) => assign(index, new Set()));
}

export function validateMessage(source: string, translated: string): void {
  if (!translated.trim()) throw new Error("Translations cannot be empty.");
  const original = parse(source, { requiresOtherClause: true });
  const target = parse(translated, { requiresOtherClause: true });
  const allRules = (elements: MessageFormatElement[]) => JSON.stringify([...new Set(rulesUsed(elements))].sort());
  const terms = ["SexToy", ...(process.env.TRANSLATION_PROTECTED_TERMS ?? "").split("|").filter(Boolean)];
  if (allRules(original) !== allRules(target) || !sameRules(original, target, terms)) throw new Error("Translation changed ICU variables, tags, message rules, or protected literals.");
}

export function validateCatalog(source: MessageCatalog, translated: MessageCatalog): { messages: number; hash: string } {
  const from = flattenCatalog(source); const to = flattenCatalog(translated);
  if (JSON.stringify(Object.keys(from).sort()) !== JSON.stringify(Object.keys(to).sort())) throw new Error("Catalog must contain exactly all source message keys.");
  for (const [key, value] of Object.entries(from)) {
    try { validateMessage(value, to[key]); } catch (error) { throw new Error(`${key}: ${error instanceof Error ? error.message : "Invalid ICU message."}`); }
  }
  return { messages: Object.keys(from).length, hash: contentHash(source) };
}

function literalFingerprint(elements:MessageFormatElement[],terms:string[]):string{
  let wording="";
  for(const element of elements){
    if(element.type===TYPE.literal)wording+=protectText(element.value,terms).text.replace(/ZXQPROTECTED\d+QXZ/g,"").normalize("NFKC").toLowerCase().replace(/[\p{P}\p{S}\p{Z}\s]/gu,"");
    if(element.type===TYPE.tag)wording+=literalFingerprint(element.children,terms);
    if(element.type===TYPE.plural||element.type===TYPE.select)wording+=[...new Set(Object.values(element.options).map(option=>literalFingerprint(option.value,terms)))].sort().join("|");
  }
  return wording;
}

/** Structural validation cannot prove linguistic accuracy, but unchanged source is not a translation. */
export function assertTranslatedCatalog(source:MessageCatalog,translated:MessageCatalog,targetLocale:string):{changedMessages:number;unchangedMessages:string[]}{
  const targetLanguage=new Intl.Locale(canonicalLocale(targetLocale));
  if(targetLanguage.language==="en"&&targetLanguage.maximize().script==="Latn")return {changedMessages:0,unchangedMessages:[]};
  const from=flattenCatalog(source),to=flattenCatalog(translated);
  const terms=["SexToy",...(process.env.TRANSLATION_PROTECTED_TERMS??"").split("|").filter(Boolean)];
  let changedMessages=0;
  const unchangedMessages:string[]=[];
  for(const [key,value]of Object.entries(from)){
    const original=literalFingerprint(parse(value),terms);
    // Protected brands, URLs, values and pure ICU arguments carry no prose
    // requiring translation. Proper names without an explicit protected term
    // remain visible to the reviewer rather than being guessed as exempt.
    if(!original)continue;
    if(original!==literalFingerprint(parse(to[key]),terms))changedMessages++;
    else unchangedMessages.push(key);
  }
  if(!changedMessages&&unchangedMessages.length)throw new Error("The catalog contains unchanged English source messages. Provide real translations before preparing this language.");
  return {changedMessages,unchangedMessages:unchangedMessages.sort()};
}

/** Detect script in source content, never visitor language. Mixed source is not relabelled English. */
export function sourceLanguage(value: string): string {
  if (/[\u0980-\u09ff]/u.test(value)) return "bn";
  // Script alone cannot identify Arabic vs Urdu, Chinese writing system, or
  // other multi-language scripts. Mark unknown instead of labelling it English.
  if (/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(value)) return "und";
  return "en";
}

export function translationCacheKey(input: { entityType: string; entityId: string; field: string; sourceLocale: string; targetLocale: string; sourceHash: string; contextHash: string }): string {
  return contentHash(input);
}

export function canReplaceTranslation(existing: { origin: string; sourceHash: string; reviewedAt?:Date|null;reviewedBy?:string|null } | null, currentHash: string, jobHash: string): boolean {
  return currentHash === jobHash && existing?.origin !== "manual"&&!existing?.reviewedAt&&!existing?.reviewedBy;
}
