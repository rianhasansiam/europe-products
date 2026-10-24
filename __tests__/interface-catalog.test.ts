import { describe, expect, it } from "vitest";
import { createTranslator, type AbstractIntlMessages } from "next-intl";
import { bindInterfaceTranslations } from "@/components/i18n/translate";
import english from "@/messages/interface-en.json";
import bengali from "@/messages/interface-bn.json";
import keys from "@/messages/interface-keys.json";
import { validateCatalog } from "@/lib/translations/validation";

describe("structured interface catalogs", () => {
  it("has actual Bengali translations for every required English message and valid ICU", () => {
    const count = Object.values(english).reduce<number>((total, scope) => total + Object.keys(scope).length, 0);
    expect(validateCatalog(english, bengali).messages).toBe(count);
    const values = Object.values(bengali).flatMap(Object.values);
    expect(values.filter((message) => /[\u0980-\u09ff]/.test(message)).length / values.length).toBeGreaterThan(0.9);
  });

  it("resolves shared sources in the namespaces actually available to the route", () => {
    const namespace = "InterfaceLayoutFooter";
    const key = keys[namespace].Home;
    const translate = createTranslator({ locale: "bn", messages: { [namespace]: { [key]: "হোম" } } });
    const source = bindInterfaceTranslations("InterfaceAboutPage", translate);
    expect(source("Home")).toBe("হোম");
  });

  it("preserves unknown source content and safely formats explicit fallback interpolation", () => {
    const translate = createTranslator({ locale: "en", messages: {} as AbstractIntlMessages });
    const source = bindInterfaceTranslations("InterfaceMessages", translate);
    expect(source("Example product name")).toBe("Example product name");
    expect(source("Unavailable: {subject}", { subject: "specifications" })).toBe("Unavailable: specifications");
    expect(source("__proto__")).toBe("__proto__");
    expect(source("constructor")).toBe("constructor");
  });

  it("uses ICU plural rules for the complete saved-item sentence", () => {
    const translate = createTranslator({ locale: "bn", messages: bengali });
    const source = bindInterfaceTranslations("InterfaceMessages", translate);
    const message = "{count, plural, one {# item parked for next time} other {# items parked for next time}}";
    expect(source(message, { count: 1 })).toContain("পণ্য পরে কেনার জন্য সংরক্ষিত");
    expect(source(message, { count: 3 })).toContain("৩");
    expect(source(message, { count: 3 })).not.toContain("{count");
  });
});
