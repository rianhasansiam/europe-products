import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LibreTranslateProvider,
  ProviderSetupError,
  UnsupportedTranslationPairError,
  supportsTranslationPair,
} from "@/lib/translations/provider";

const installed = [
  { code: "en", name: "English", targets: ["en", "fr"] },
  { code: "fr", name: "French", targets: ["en", "fr"] },
];
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  for (const name of ["LIBRETRANSLATE_URL", "LIBRETRANSLATE_API_KEY", "LIBRETRANSLATE_TIMEOUT_MS", "LIBRETRANSLATE_MAX_CHARACTERS", "LIBRETRANSLATE_BATCH_SIZE"]) vi.stubEnv(name, undefined);
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/health")) return json({ status: "ok" });
    if (url.endsWith("/languages")) return json(installed);
    const { q } = JSON.parse(init!.body as string) as { q: string[] };
    return json({ translatedText: q.map(text => `Traduit: ${text}`) });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("server-side LibreTranslate provider", () => {
  it("uses local HTTP by default and validates service health", async () => {
    const provider = new LibreTranslateProvider();
    expect(provider.name).toBe("libretranslate");
    await provider.health();
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:5001/health", expect.objectContaining({ method: "GET", cache: "no-store", credentials: "omit", redirect: "error" }));
    fetchMock.mockResolvedValueOnce(json({ status: "starting" }));
    await expect(provider.health()).rejects.toThrow("invalid health");
  });

  it("keeps optional credentials in POST bodies and preserves a reverse-proxy prefix", async () => {
    const provider = new LibreTranslateProvider({ url: "http://127.0.0.1:5000/translation/", apiKey: "test-server-secret" });
    expect(await provider.translate(["Hello"], "en", "fr")).toEqual(["Traduit: Hello"]);
    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:5000/translation/languages");
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("body");
    expect(fetchMock.mock.calls[1][0]).toBe("http://127.0.0.1:5000/translation/translate");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ q: ["Hello"], source: "en", target: "fr", format: "text", api_key: "test-server-secret" });
    expect(fetchMock.mock.calls[1][1].headers).not.toHaveProperty("Authorization");
  });

  it("requires no paid API key and reads bounded server environment settings", async () => {
    vi.stubEnv("LIBRETRANSLATE_URL", "http://127.0.0.1:5002");
    vi.stubEnv("LIBRETRANSLATE_BATCH_SIZE", "1");
    const provider = new LibreTranslateProvider();
    await provider.translate(["Hello", "Goodbye"], "en", "fr");
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["http://127.0.0.1:5002/languages", "http://127.0.0.1:5002/translate", "http://127.0.0.1:5002/translate"]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty("api_key");
  });

  it("retains exact directional pairs rather than assuming every listed language can translate to every other", async () => {
    fetchMock.mockResolvedValueOnce(json([
      { code: "en", name: "English", targets: ["en", "fr"] },
      { code: "fr", name: "French", targets: ["fr"] },
      { code: "bn", name: "Bengali", targets: ["bn", "en"] },
    ]));
    const languages = await new LibreTranslateProvider().supportedLanguages();
    expect(languages).toEqual([
      { code: "en", name: "English", targets: ["en", "fr"], supportsSource: true, supportsTarget: true },
      { code: "fr", name: "French", targets: ["fr"], supportsSource: false, supportsTarget: true },
      { code: "bn", name: "Bengali", targets: ["bn", "en"], supportsSource: true, supportsTarget: false },
    ]);
    expect(supportsTranslationPair(languages, "en", "fr")).toBe(true);
    expect(supportsTranslationPair(languages, "fr", "en")).toBe(false);
    expect(supportsTranslationPair(languages, "en", "bn")).toBe(false);
  });

  it("accepts an engine with no installed models without inventing supported languages", async () => {
    fetchMock.mockResolvedValueOnce(json([]));
    expect(await new LibreTranslateProvider().supportedLanguages()).toEqual([]);
  });

  it.each([
    { languages: installed },
    [{ code: "en", name: "English" }],
    [{ code: "en", name: "English", targets: ["fr"] }],
    [{ code: "en", name: "English", targets: ["invalid_locale"] }],
    [installed[0], installed[0]],
  ])("rejects malformed or incomplete language capability metadata", async value => {
    fetchMock.mockResolvedValueOnce(json(value));
    await expect(new LibreTranslateProvider().supportedLanguages()).rejects.toThrow("invalid language capability");
  });

  it("rejects unavailable pairs before transmitting source content", async () => {
    await expect(new LibreTranslateProvider().translate(["Private source must not be sent"], "en", "mt")).rejects.toBeInstanceOf(UnsupportedTranslationPairError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/languages$/);
  });

  it("preserves Chinese script variants using the API's BCP 47 codes", async () => {
    fetchMock.mockResolvedValueOnce(json([
      { code: "en", name: "English", targets: ["en", "zh-Hans"] },
      { code: "zh-Hans", name: "Chinese", targets: ["en", "zh-Hans"] },
      { code: "zh-Hant", name: "Chinese (traditional)", targets: ["zh-Hant"] },
    ]));
    const provider = new LibreTranslateProvider();
    await expect(provider.translate(["Pump"], "en", "zh-Hant")).rejects.toBeInstanceOf(UnsupportedTranslationPairError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await provider.translate(["Pump"], "en", "zh-Hans");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).target).toBe("zh-Hans");
  });

  it("bounds sequential request characters and item counts while retaining input order", async () => {
    const provider = new LibreTranslateProvider({ maxCharacters: 6, batchSize: 2 });
    const texts = ["Hi", "Hey", "Hello", "Yo", "OK", "Bye"];
    expect(await provider.translate(texts, "en", "fr")).toEqual(texts.map(text => `Traduit: ${text}`));
    expect(fetchMock.mock.calls.slice(1).map(call => JSON.parse(call[1].body).q)).toEqual([["Hi", "Hey"], ["Hello"], ["Yo", "OK"], ["Bye"]]);
  });

  it("counts Unicode code points as the pinned Python API does", async () => {
    const provider = new LibreTranslateProvider({ maxCharacters: 2 });
    expect(await provider.translate(["😀😀"], "en", "fr")).toEqual(["Traduit: 😀😀"]);
  });

  it("rejects oversized individual texts and total workloads before HTTP", async () => {
    await expect(new LibreTranslateProvider({ maxCharacters: 5 }).translate(["Too long"], "en", "fr")).rejects.toThrow("LIBRETRANSLATE_MAX_CHARACTERS");
    await expect(new LibreTranslateProvider().translate(Array(101).fill("a"), "en", "fr")).rejects.toThrow("bounded batch");
    await expect(new LibreTranslateProvider().translate(Array(6).fill("a".repeat(5_000)), "en", "fr")).rejects.toThrow("bounded character");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["", "file:///etc/passwd", "http://user:secret@localhost:5000", "http://localhost:5000?api_key=secret", "http://localhost:5000/#secret"])("rejects invalid endpoint configuration without revealing it", async url => {
    const failure = new LibreTranslateProvider({ url }).translate(["Hello"], "en", "fr");
    await expect(failure).rejects.toBeInstanceOf(ProviderSetupError);
    await expect(failure).rejects.not.toThrow("secret");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([{ timeoutMs: 0 }, { timeoutMs: 120_001 }, { maxCharacters: -1 }, { batchSize: 101 }, { batchSize: 1.5 }])("rejects invalid request bounds rather than silently disabling them", async options => {
    await expect(new LibreTranslateProvider(options).supportedLanguages()).rejects.toBeInstanceOf(ProviderSetupError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([{ translatedText: "Bonjour" }, { translatedText: [] }, { translatedText: [123] }, { translatedText: [""] }, { translatedText: ["Bonjour", "Extra"] }])("rejects malformed or incomplete translation arrays", async result => {
    fetchMock.mockResolvedValueOnce(json(installed)).mockResolvedValueOnce(json(result));
    await expect(new LibreTranslateProvider().translate(["Hello"], "en", "fr")).rejects.toThrow("incomplete or invalid translation batch");
  });

  it("does not return a partial successful batch after a later request fails", async () => {
    fetchMock.mockResolvedValueOnce(json(installed)).mockResolvedValueOnce(json({ translatedText: ["Bonjour"] })).mockResolvedValueOnce(json({ error: "source text secret" }, 500));
    await expect(new LibreTranslateProvider({ batchSize: 1 }).translate(["Hello", "Goodbye"], "en", "fr")).rejects.toThrow("request failed");
  });

  it.each([400, 401, 403, 429, 500])("sanitizes upstream HTTP %s failures", async status => {
    fetchMock.mockResolvedValueOnce(json(installed)).mockResolvedValueOnce(json({ error: "test-server-secret and Hello customer" }, status));
    const error = await new LibreTranslateProvider({ apiKey: "test-server-secret" }).translate(["Hello customer"], "en", "fr").catch(error => error);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).not.toMatch(/test-server-secret|Hello customer/);
    expect(error.cause).toBeUndefined();
  });

  it("sanitizes connectivity errors and JSON parser details", async () => {
    fetchMock.mockRejectedValueOnce(new Error("http://secret-url test-server-secret"));
    await expect(new LibreTranslateProvider().supportedLanguages()).rejects.toThrow("unavailable");
    fetchMock.mockResolvedValueOnce(new Response("secret source is not JSON"));
    const error = await new LibreTranslateProvider().supportedLanguages().catch(error => error);
    expect(error.message).not.toContain("secret source");
  });

  it("aborts requests at the configured timeout and emits a sanitized failure", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("source secret timeout")), { once: true })));
    const pending = new LibreTranslateProvider({ timeoutMs: 25 }).supportedLanguages();
    const assertion = expect(pending).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it("bounds response size", async () => {
    fetchMock.mockResolvedValueOnce(new Response("x".repeat(2 * 1024 * 1024 + 1)));
    await expect(new LibreTranslateProvider().supportedLanguages()).rejects.toThrow("bounded response");
  });

  it("reuses recent verified pairs, protects them against caller mutation, and explicitly refreshes", async () => {
    const provider = new LibreTranslateProvider();
    const languages = await provider.supportedLanguages();
    languages[0].targets!.push("mt");
    await provider.translate(["Hello"], "en", "fr");
    await expect(provider.translate(["Hello"], "en", "mt")).rejects.toBeInstanceOf(UnsupportedTranslationPairError);
    await provider.supportedLanguages();
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["http://127.0.0.1:5001/languages", "http://127.0.0.1:5001/translate", "http://127.0.0.1:5001/languages"]);
  });

  it("coalesces concurrent capability discovery without retaining failed requests", async () => {
    const provider = new LibreTranslateProvider();
    await Promise.all([provider.supportedLanguages(), provider.supportedLanguages()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(provider.supportedLanguages()).rejects.toThrow("unavailable");
    expect(await provider.supportedLanguages()).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not make HTTP calls for empty work or identical source and target locales", async () => {
    const provider = new LibreTranslateProvider();
    expect(await provider.translate([], "en", "fr")).toEqual([]);
    expect(await provider.translate(["Hello"], "en", "en")).toEqual(["Hello"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
