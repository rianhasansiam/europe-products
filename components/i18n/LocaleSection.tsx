import type { ReactNode } from "react";
import IntlProvider from "./IntlProvider";
import { loadMessages, selectClientMessages } from "@/lib/i18n/catalogs";
import { getRequestLocale } from "@/lib/i18n/server";

/** Feature layouts supply their namespace on client navigation, when the root is retained. */
export default async function LocaleSection({ children, pathname }: { children: ReactNode; pathname: string }) {
  const locale = await getRequestLocale();
  return <IntlProvider locale={locale} messages={selectClientMessages(await loadMessages(locale), pathname)}>{children}</IntlProvider>;
}
