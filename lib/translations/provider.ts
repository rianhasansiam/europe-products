import "server-only";
export type ProviderLanguage = {
  code: string;
  name: string;
  supportsSource: boolean;
  supportsTarget: boolean;
  /** Exact outgoing pairs advertised by the running engine, including pivot pairs. */
  targets?: string[];
};
export interface TranslationProvider {
  readonly name: string;
  supportedLanguages(): Promise<ProviderLanguage[]>;
  translate(texts: string[], source: string, target: string): Promise<string[]>;
}

export const LIBRETRANSLATE_DEFAULT_MAX_CHARACTERS = 5_000;
export const LIBRETRANSLATE_DEFAULT_BATCH_SIZE = 20;
// macOS commonly reserves port 5000 for AirPlay Receiver. The dedicated native
// service uses a loopback-only project default and accepts an explicit override.
export const LIBRETRANSLATE_DEFAULT_URL = "http://127.0.0.1:5001";

export type LibreTranslateOptions = {
  url?: string;
  apiKey?: string;
  timeoutMs?: number;
  maxCharacters?: number;
  batchSize?: number;
};

type Configuration = Required<Omit<LibreTranslateOptions, "apiKey">> & { apiKey?: string };
const languageCodePattern = /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/;
const maxWorkloadCharacters = 25_000;
const maxResponseBytes = 2 * 1024 * 1024;

export class ProviderSetupError extends Error {
  constructor() {
    super("LibreTranslate configuration is invalid. Check LIBRETRANSLATE_URL and its bounded request settings; manual imports remain available.");
    this.name = "ProviderSetupError";
  }
}

export class UnsupportedTranslationPairError extends Error {
  constructor() {
    super("The running LibreTranslate models do not support this translation pair. Refresh provider capabilities or import a reviewed manual translation.");
    this.name = "UnsupportedTranslationPairError";
  }
}

class ProviderRequestError extends Error {}

/** Listing a target code alone does not establish a source-to-target pair. */
export function supportsTranslationPair(languages: readonly ProviderLanguage[], source: string, target: string): boolean {
  return languages.some(language => language.code === target)
    && !!languages.find(language => language.code === source)?.targets?.includes(target);
}

function boundedInteger(value: number | string | undefined, fallback: number, maximum: number): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) throw new ProviderSetupError();
  return parsed;
}

function parseLanguages(value: unknown): ProviderLanguage[] {
  const invalid = () => new ProviderRequestError("LibreTranslate returned an invalid language capability response.");
  if (!Array.isArray(value) || value.length > 512) throw invalid();
  const rows: { code: string; name: string; targets: string[] }[] = [];
  for (const language of value) {
    if (!language || typeof language !== "object" || Array.isArray(language)) throw invalid();
    const { code, name, targets } = language;
    if (typeof code !== "string" || code.length > 32 || !languageCodePattern.test(code)
      || typeof name !== "string" || !name.trim() || name.length > 200
      || !Array.isArray(targets) || targets.length > 512
      || targets.some(target => typeof target !== "string" || target.length > 32 || !languageCodePattern.test(target))) throw invalid();
    rows.push({ code, name, targets: [...new Set<string>(targets)] });
  }
  const codes = new Set(rows.map(row => row.code));
  if (codes.size !== rows.length || rows.some(row => row.targets.some(target => !codes.has(target)))) throw invalid();
  const incoming = new Set(rows.flatMap(row => row.targets.filter(target => target !== row.code)));
  return rows.map(row => ({ ...row, supportsSource: row.targets.some(target => target !== row.code), supportsTarget: incoming.has(row.code) }));
}

function copyLanguages(languages: readonly ProviderLanguage[]): ProviderLanguage[] {
  return languages.map(language => ({ ...language, targets: [...(language.targets ?? [])] }));
}

/** Official LibreTranslate API only. Credentials, text and calls stay on the server. */
export class LibreTranslateProvider implements TranslationProvider {
  readonly name = "libretranslate";
  private configuration?: Configuration;
  private capabilities?: { languages: ProviderLanguage[]; expiresAt: number };
  private pendingCapabilities?: Promise<ProviderLanguage[]>;

  constructor(private readonly options: LibreTranslateOptions = {}) {}

  private config(): Configuration {
    if (this.configuration) return this.configuration;
    let url: URL;
    try { url = new URL(this.options.url ?? process.env.LIBRETRANSLATE_URL ?? LIBRETRANSLATE_DEFAULT_URL); }
    catch { throw new ProviderSetupError(); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new ProviderSetupError();
    const apiKey = this.options.apiKey ?? process.env.LIBRETRANSLATE_API_KEY;
    if (apiKey && (apiKey.length > 1_024 || /[\r\n]/.test(apiKey))) throw new ProviderSetupError();
    this.configuration = {
      url: url.toString().replace(/\/$/, ""),
      apiKey: apiKey || undefined,
      timeoutMs: boundedInteger(this.options.timeoutMs ?? process.env.LIBRETRANSLATE_TIMEOUT_MS, 60_000, 120_000),
      maxCharacters: boundedInteger(this.options.maxCharacters ?? process.env.LIBRETRANSLATE_MAX_CHARACTERS, LIBRETRANSLATE_DEFAULT_MAX_CHARACTERS, maxWorkloadCharacters),
      batchSize: boundedInteger(this.options.batchSize ?? process.env.LIBRETRANSLATE_BATCH_SIZE, LIBRETRANSLATE_DEFAULT_BATCH_SIZE, 100),
    };
    return this.configuration;
  }

  private async request(path: "/health" | "/languages" | "/translate", body?: object): Promise<unknown> {
    const configuration = this.config();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), configuration.timeoutMs);
    try {
      const response = await fetch(`${configuration.url}${path}`, {
        method: body ? "POST" : "GET", cache: "no-store", credentials: "omit", redirect: "error",
        headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify({ ...body, ...(configuration.apiKey ? { api_key: configuration.apiKey } : {}) }) } : {}),
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new ProviderRequestError("LibreTranslate rejected server authentication. Check the configured API key.");
        if (response.status === 429) throw new ProviderRequestError("LibreTranslate is rate limited. Retry the controlled job later.");
        throw new ProviderRequestError("LibreTranslate request failed. Check local service health, installed models and request limits.");
      }
      const reader = response.body?.getReader();
      if (!reader) throw new ProviderRequestError("LibreTranslate returned an invalid API response.");
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > maxResponseBytes) { await reader.cancel(); throw new ProviderRequestError("LibreTranslate response exceeds the bounded response limit."); }
        chunks.push(chunk.value);
      }
      const buffer = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
      return JSON.parse(new TextDecoder().decode(buffer)) as unknown;
    } catch (error) {
      if (controller.signal.aborted) throw new ProviderRequestError("LibreTranslate request timed out. Retry the controlled job after checking local service health.");
      if (error instanceof ProviderRequestError) throw error;
      // Do not persist raw HTTP bodies, URLs, source text, credentials, or causes.
      throw new ProviderRequestError("LibreTranslate is unavailable or returned an invalid response. Check local service health and connectivity.");
    } finally { clearTimeout(timer); }
  }

  async health(): Promise<void> {
    const result = await this.request("/health");
    if (!result || typeof result !== "object" || (result as Record<string, unknown>).status !== "ok") throw new ProviderRequestError("LibreTranslate returned an invalid health response.");
  }

  /** Explicit refresh always consults the engine; translate reuses pairs for at most a minute. */
  async supportedLanguages(): Promise<ProviderLanguage[]> {
    if (!this.pendingCapabilities) {
      this.pendingCapabilities = (async () => {
        const languages = parseLanguages(await this.request("/languages"));
        this.capabilities = { languages, expiresAt: Date.now() + 60_000 };
        return languages;
      })();
    }
    const pending = this.pendingCapabilities;
    try { return copyLanguages(await pending); }
    finally { if (this.pendingCapabilities === pending) this.pendingCapabilities = undefined; }
  }

  async translate(texts: string[], source: string, target: string): Promise<string[]> {
    if (!texts.length) return [];
    if (!languageCodePattern.test(source) || source.length > 32 || !languageCodePattern.test(target) || target.length > 32) throw new UnsupportedTranslationPairError();
    const { maxCharacters, batchSize } = this.config();
    if (texts.length > 100 || texts.some(text => typeof text !== "string" || text.length > maxWorkloadCharacters * 2)) throw new Error("Translation provider workload exceeds the bounded batch limit.");
    const lengths = texts.map(text => [...text].length);
    if (lengths.reduce((sum, length) => sum + length, 0) > maxWorkloadCharacters) throw new Error("Translation provider workload exceeds the bounded character limit.");
    if (lengths.some(length => length > maxCharacters)) throw new Error("One translation text exceeds LIBRETRANSLATE_MAX_CHARACTERS. Split the source at a safe text boundary or import a reviewed manual translation.");
    if (source === target) return [...texts];
    const languages = this.capabilities && this.capabilities.expiresAt > Date.now()
      ? this.capabilities.languages : await this.supportedLanguages();
    if (!supportsTranslationPair(languages, source, target)) throw new UnsupportedTranslationPairError();

    const translated: string[] = [];
    // Sequential bounded requests avoid multiplying the engine's CPU workload.
    for (let start = 0; start < texts.length;) {
      let end = start;
      let characters = 0;
      while (end < texts.length && end - start < batchSize && characters + lengths[end] <= maxCharacters) { characters += lengths[end]; end++; }
      const input = texts.slice(start, end);
      const result = await this.request("/translate", { q: input, source, target, format: "text" });
      const values = result && typeof result === "object" && !Array.isArray(result)
        ? (result as Record<string, unknown>).translatedText : undefined;
      if (!Array.isArray(values) || values.length !== input.length || values.some((value, index) => typeof value !== "string" || (input[index].trim() && !value.trim()))) throw new ProviderRequestError("LibreTranslate returned an incomplete or invalid translation batch.");
      translated.push(...values);
      start = end;
    }
    return translated;
  }
}
