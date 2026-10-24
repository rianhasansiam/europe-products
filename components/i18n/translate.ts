import type { ReactNode } from "react";
import { createTranslator, useTranslations } from "next-intl";
import interfaceKeys from "@/messages/interface-keys.json";
import adminKeys from "@/messages/admin-keys.json";

export type InterfaceValues = Record<string, string | number | Date>;
export type InterfaceRichValues = Record<string, string | number | Date | ((chunks: ReactNode) => ReactNode)>;
export type InterfaceTranslator = {
  (source: string | null | undefined, values?: InterfaceValues): string;
  rich(source: string, values: InterfaceRichValues): ReactNode;
};
const catalogs: Record<string, Record<string, string>> = Object.assign(Object.create(null), interfaceKeys, adminKeys);
const sharedKeys: Record<string, string[]> = Object.create(null);
for (const [scope, keys] of Object.entries(catalogs)) {
  for (const [source, key] of Object.entries(keys)) (sharedKeys[source] ??= []).push(`${scope}.${key}`);
}
const translators = new WeakMap<object, Map<string, InterfaceTranslator>>();

/** Resolve migrated static messages to meaningful keys; unknown dynamic content stays intact. */
export function bindInterfaceTranslations(namespace: string, translate: ReturnType<typeof useTranslations>): InterfaceTranslator {
  const cached = translators.get(translate)?.get(namespace);
  if (cached) return cached;
  const resolveKey = (source: string) => {
    const scopedMessages = Object.hasOwn(catalogs, namespace) ? catalogs[namespace] : undefined;
    const scopedKey = scopedMessages && Object.hasOwn(scopedMessages, source) ? scopedMessages[source] : undefined;
    const scopedPath = scopedKey ? `${namespace}.${scopedKey}` : undefined;
    return scopedPath && translate.has(scopedPath)
      ? scopedPath
      : sharedKeys[source]?.find((path) => translate.has(path));
  };
  const translateSource = ((source, values) => {
    if (!source) return source ?? "";
    const key = resolveKey(source);
    if (key) return translate(key, values);
    if (!values) return source;
    return createTranslator({ locale: "en", messages: { original: source } })("original", values);
  }) as InterfaceTranslator;
  translateSource.rich = (source, values) => {
    const key = resolveKey(source);
    return key
      ? translate.rich(key, values)
      : createTranslator({ locale: "en", messages: { original: source } }).rich("original", values);
  };
  const scopes = translators.get(translate) ?? new Map<string, InterfaceTranslator>();
  scopes.set(namespace, translateSource);
  translators.set(translate, scopes);
  return translateSource;
}

/** Shared hook supported by next-intl in client and synchronous server components. */
export function useInterfaceTranslations(namespace: string): InterfaceTranslator {
  return bindInterfaceTranslations(namespace, useTranslations());
}
