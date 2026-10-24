import "server-only";

import { cache } from "react";
import type { AbstractIntlMessages } from "next-intl";
import { DEFAULT_LOCALE } from "./registry";
import { getStoredInterfaceCatalog } from "@/lib/translations/languages";
import { contentHash, validateCatalog } from "@/lib/translations/validation";

const bundled = {
  en: async () => {
    const [core, website, admin, management, seo, notifications] = await Promise.all([import("@/messages/core-en.json"), import("@/messages/interface-en.json"), import("@/messages/admin-en.json"), import("@/messages/translation-management-en.json"), import("@/messages/seo-en.json"), import("@/messages/notifications-en.json")]);
    return { ...core.default, ...website.default, ...admin.default, ...management.default, ...seo.default, ...notifications.default } as AbstractIntlMessages;
  },
  bn: async () => {
    const [core, website, admin, management, seo, notifications] = await Promise.all([import("@/messages/core-bn.json"), import("@/messages/interface-bn.json"), import("@/messages/admin-bn.json"), import("@/messages/translation-management-bn.json"), import("@/messages/seo-bn.json"), import("@/messages/notifications-bn.json")]);
    return { ...core.default, ...website.default, ...admin.default, ...management.default, ...seo.default, ...notifications.default } as AbstractIntlMessages;
  },
};
const validatedStoredCatalogs = new WeakMap<object, string>();

export const loadBundledMessages = cache(async (locale = DEFAULT_LOCALE): Promise<AbstractIntlMessages> => {
  const loader = bundled[locale as keyof typeof bundled];
  return loader ? loader() : {};
});

export const loadMessages = cache(async (locale: string): Promise<AbstractIntlMessages> => {
  if (locale === DEFAULT_LOCALE) return loadBundledMessages(locale);
  const source = await loadBundledMessages(DEFAULT_LOCALE);
  const sourceHash = contentHash(source);
  const stored = await getStoredInterfaceCatalog(locale, sourceHash);
  if (stored) {
    try {
      if (validatedStoredCatalogs.get(stored) !== sourceHash) {
        validateCatalog(source, stored);
        validatedStoredCatalogs.set(stored, sourceHash);
      }
      return stored as AbstractIntlMessages;
    } catch { console.error("A stored language catalog failed validation and is unavailable."); }
  }
  return loadBundledMessages(locale);
});

/** Active route namespaces only; administrator text is never sent to the storefront. */
export function selectClientMessages(messages: AbstractIntlMessages, pathname: string): AbstractIntlMessages {
  const feature = pathname.split("/")[1];
  const selected = feature ? `Interface${feature[0].toUpperCase()}${feature.slice(1)}` : "InterfaceComponents";
  const common = ["Navigation", "Language", "Loading", "States", "Validation", "InterfaceMessages", "InterfaceLayout", "InterfaceUi", "InterfaceProduct", "InterfacePolicy", "InterfaceAirwallex", "InterfaceComponents"];
  const isAdmin = pathname.startsWith("/admin");
  return Object.fromEntries(Object.entries(messages).filter(([namespace]) =>
    (isAdmin && (namespace.startsWith("Admin") || namespace === "translationManagement")) ||
    (["profile", "checkout"].includes(feature) && namespace.startsWith("InterfaceCart")) ||
    common.some((prefix) => namespace.startsWith(prefix)) ||
    namespace.startsWith(selected) ||
    (["login", "register"].includes(feature) && (namespace.startsWith("InterfaceComponents") || namespace.startsWith("InterfaceLogin") || namespace.startsWith("InterfaceRegister"))),
  ));
}
