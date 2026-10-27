import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import english from "@/messages/core-en.json";
import bengali from "@/messages/core-bn.json";
import { usesNativeLanguageLink } from "@/components/i18n/PreparedLanguageLinksClient";

const mocks = vi.hoisted(() => ({
  path: "/contact",
  rows: [] as Array<{ code: string; englishName: string; nativeName: string; direction: "ltr" | "rtl"; prepared: boolean; published: boolean; interfaceCatalog?: unknown }>,
}));
vi.mock("@/lib/i18n/server", () => ({
  getRequestPath: async () => mocks.path,
  getPublishedLanguages: async () => mocks.rows,
}));
vi.mock("@/lib/seo/localized-metadata", () => ({ PREPARED_STATIC_PATHS: { "/contact": true } }));
import PreparedLanguageLinks from "@/components/i18n/PreparedLanguageLinks";

beforeEach(() => {
  mocks.path = "/contact";
  mocks.rows = [
    { code: "en", englishName: "English", nativeName: "English", direction: "ltr", prepared: true, published: true },
    { code: "bn", englishName: "Bengali", nativeName: "বাংলা", direction: "ltr", prepared: true, published: true, interfaceCatalog: { privateCatalogMarker: "Other language messages stay server-side" } },
  ];
});

describe("legacy prepared language navigation", () => {
  it("renders unprefixed anchors in initial server HTML", async () => {
    const element = await PreparedLanguageLinks({});
    const html = renderToStaticMarkup(createElement(NextIntlClientProvider, { locale: "en", messages: english, timeZone: "Asia/Dhaka", children: element } satisfies ComponentProps<typeof NextIntlClientProvider>));
    expect((html.match(/href="\/contact"/g) ?? []).length).toBe(2);
    expect(html).not.toMatch(/href="\/(?:en|bn)\/contact"/);
    expect(html).toMatch(/hrefLang="bn"/i);
    expect(html).toMatch(/href="\/contact" hrefLang="en"[^>]*aria-current="page"/i);
    expect(html).toContain(english.Language.choose);
    expect(html).toContain("বাংলা");
    expect(html).not.toContain("privateCatalogMarker");
    expect(element?.props.languages).toEqual([
      { code: "en", englishName: "English", nativeName: "English", direction: "ltr" },
      { code: "bn", englishName: "Bengali", nativeName: "বাংলা", direction: "ltr" },
    ]);
  });
  it("keeps rendered labels and selection synchronized with the active Bengali catalog", async () => {
    const html = renderToStaticMarkup(createElement(NextIntlClientProvider, { locale: "bn", messages: bengali, timeZone: "Asia/Dhaka", children: await PreparedLanguageLinks({}) } satisfies ComponentProps<typeof NextIntlClientProvider>));
    expect(html).toContain(bengali.Language.choose);
    expect(html).toMatch(/href="\/contact" hrefLang="bn"[^>]*aria-current="page"/i);
    expect(html).not.toMatch(/href="\/contact" hrefLang="en"[^>]*aria-current="page"/i);
  });
  it("excludes unprepared/unpublished variants and source-content pages", async () => {
    mocks.rows.push(
      { code: "ar", englishName: "Arabic", nativeName: "العربية", direction: "rtl", prepared: false, published: true },
      { code: "fr", englishName: "French", nativeName: "Français", direction: "ltr", prepared: true, published: false },
    );
    const element = await PreparedLanguageLinks({ pathname: "/contact" });
    expect(element?.props.languages.map((language: { code: string }) => language.code)).toEqual(["en", "bn"]);
    expect(await PreparedLanguageLinks({ pathname: "/products" })).toBeNull();
    expect(await PreparedLanguageLinks({ pathname: "/privacy-policy" })).toBeNull();
    mocks.rows = [mocks.rows[0]];
    expect(await PreparedLanguageLinks({ pathname: "/contact" })).toBeNull();
  });
  it("uses the recovery flow for primary clicks and permits native modifier/new-tab navigation", () => {
    const primary = { button: 0, defaultPrevented: false, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
    expect(usesNativeLanguageLink(primary)).toBe(false);
    for (const key of ["metaKey", "ctrlKey", "shiftKey", "altKey", "defaultPrevented"] as const) expect(usesNativeLanguageLink({ ...primary, [key]: true })).toBe(true);
    expect(usesNativeLanguageLink({ ...primary, button: 1 })).toBe(true);
  });
});
