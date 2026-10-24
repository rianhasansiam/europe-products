import publication from "./published.json";

/** Language and currency are intentionally independent. Never infer this from geo. */
export const DEFAULT_LOCALE = "en";
export const SOURCE_LOCALE = "en";
export const LOCALE_COOKIE = "bangbuy_locale";
export const LOCALE_HEADER = "x-bangbuy-locale";
export const PATH_HEADER = "x-bangbuy-path";
export const URL_HEADER = "x-bangbuy-url";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type LocaleDefinition = {
  code: string;
  englishName: string;
  nativeName: string;
  direction: "ltr" | "rtl";
  fallbackLocale: string | null;
  providerCode: string | null;
  available: boolean;
  prepared: boolean;
  published: boolean;
};

const names: Record<string, [string, string, string | null]> = {
  en: ["English", "English", "en"],
  bn: ["Bengali", "বাংলা", "bn"],
  ar: ["Arabic", "العربية", "ar"],
  ur: ["Urdu", "اردو", "ur"],
  fa: ["Persian", "فارسی", "fa"],
  he: ["Hebrew", "עברית", "he"],
  hi: ["Hindi", "हिन्दी", "hi"],
  fr: ["French", "Français", "fr"],
  de: ["German", "Deutsch", "de"],
  es: ["Spanish", "Español", "es"],
  it: ["Italian", "Italiano", "it"],
  pt: ["Portuguese", "Português", "pt"],
  "pt-PT": ["Portuguese (Portugal)", "Português (Portugal)", "pt"],
  "pt-BR": ["Portuguese (Brazil)", "Português (Brasil)", "pt-BR"],
  nl: ["Dutch", "Nederlands", "nl"],
  pl: ["Polish", "Polski", "pl"],
  cs: ["Czech", "Čeština", "cs"],
  sk: ["Slovak", "Slovenčina", "sk"],
  hu: ["Hungarian", "Magyar", "hu"],
  ro: ["Romanian", "Română", "ro"],
  bg: ["Bulgarian", "Български", "bg"],
  hr: ["Croatian", "Hrvatski", "hr"],
  sr: ["Serbian", "Српски", "sr"],
  "sr-Latn": ["Serbian (Latin)", "Srpski", null],
  bs: ["Bosnian", "Bosanski", "bs"],
  sl: ["Slovenian", "Slovenščina", "sl"],
  sq: ["Albanian", "Shqip", "sq"],
  el: ["Greek", "Ελληνικά", "el"],
  tr: ["Turkish", "Türkçe", "tr"],
  sv: ["Swedish", "Svenska", "sv"],
  nb: ["Norwegian Bokmål", "Norsk bokmål", "nb"],
  nn: ["Norwegian Nynorsk", "Norsk nynorsk", "nn"],
  no: ["Norwegian", "Norsk", "nb"],
  da: ["Danish", "Dansk", "da"],
  fi: ["Finnish", "Suomi", "fi"],
  et: ["Estonian", "Eesti", "et"],
  lv: ["Latvian", "Latviešu", "lv"],
  lt: ["Lithuanian", "Lietuvių", "lt"],
  uk: ["Ukrainian", "Українська", "uk"],
  ru: ["Russian", "Русский", "ru"],
  be: ["Belarusian", "Беларуская", "be"],
  ca: ["Catalan", "Català", "ca"],
  ga: ["Irish", "Gaeilge", "ga"],
  mt: ["Maltese", "Malti", "mt"],
  is: ["Icelandic", "Íslenska", "is"],
  lb: ["Luxembourgish", "Lëtzebuergesch", "lb"],
  eu: ["Basque", "Euskara", "eu"],
  gl: ["Galician", "Galego", "gl"],
  cy: ["Welsh", "Cymraeg", "cy"],
  gd: ["Scottish Gaelic", "Gàidhlig", "gd"],
  mk: ["Macedonian", "Македонски", "mk"],
  hy: ["Armenian", "Հայերեն", "hy"],
  ka: ["Georgian", "ქართული", "ka"],
  az: ["Azerbaijani", "Azərbaycan dili", "az"],
  "en-GB": ["English (United Kingdom)", "English (United Kingdom)", "en"],
  ja: ["Japanese", "日本語", "ja"],
  ko: ["Korean", "한국어", "ko"],
  "zh-Hans": ["Simplified Chinese", "简体中文", "zh-Hans"],
  "zh-Hant": ["Traditional Chinese", "繁體中文", "zh-Hant"],
};

/** BCP 47 canonicalization; never conflate different Chinese writing systems. */
export function normalizeLocale(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 64 || !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value)) return null;
  const aliases: Record<string, string> = { zh: "zh-Hans", "zh-cn": "zh-Hans", "zh-sg": "zh-Hans", "zh-tw": "zh-Hant", "zh-hk": "zh-Hant" };
  try {
    return aliases[value.toLowerCase()] ?? new Intl.Locale(value).toString();
  } catch {
    return null;
  }
}

export function getLocaleDefinition(value: string): LocaleDefinition {
  const code = normalizeLocale(value) ?? DEFAULT_LOCALE;
  const language = new Intl.Locale(code);
  const preset = names[code];
  const englishName = preset?.[0] ?? new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  const nativeName = preset?.[1] ?? new Intl.DisplayNames([code], { type: "language" }).of(code) ?? englishName;
  const rtl = ["Arab", "Hebr", "Thaa", "Nkoo", "Adlm", "Rohg", "Syrc"].includes(language.script ?? language.maximize().script ?? "");
  const bundled = publication.locales.includes(code);
  return {
    code, englishName, nativeName, direction: rtl ? "rtl" : "ltr",
    fallbackLocale: null,
    providerCode: preset?.[2] ?? null,
    // A catalog's publication never implies an installed translation model.
    // The persisted /languages snapshot establishes actual directed capability.
    available: false,
    prepared: bundled,
    published: bundled,
  };
}

export function getPublishedLocales(): LocaleDefinition[] {
  return publication.locales.map(getLocaleDefinition);
}

/** Known languages stay manually importable regardless of installed model support. */
export function getRegisteredLocales(): LocaleDefinition[] {
  return Object.keys(names).map(getLocaleDefinition);
}

export function isPublishedLocale(value: unknown): value is string {
  const canonical = normalizeLocale(value);
  return canonical !== null && publication.locales.includes(canonical);
}
