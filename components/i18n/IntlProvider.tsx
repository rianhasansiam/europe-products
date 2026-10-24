"use client";

import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import type { ReactNode } from "react";

export default function IntlProvider({ children, locale, messages }: { children: ReactNode; locale: string; messages: AbstractIntlMessages }) {
  return <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Dhaka" onError={(error) => console.error("Translation rendering failed:", error.code)} getMessageFallback={() => "Content unavailable"}>{children}</NextIntlClientProvider>;
}
