import "server-only";
import { getTranslations } from "next-intl/server";
import { bindInterfaceTranslations, type InterfaceTranslator } from "./translate";

export async function getInterfaceTranslations(namespace: string): Promise<InterfaceTranslator> {
  return bindInterfaceTranslations(namespace, await getTranslations());
}
