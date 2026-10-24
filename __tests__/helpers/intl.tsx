import type { ReactNode } from "react";
import { renderToStaticMarkup as renderMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import core from "@/messages/core-en.json";
import website from "@/messages/interface-en.json";
import admin from "@/messages/admin-en.json";
import management from "@/messages/translation-management-en.json";

/** Existing commerce regression fixtures run under the real default English catalog. */
export function renderToStaticMarkup(node: ReactNode): string {
  return renderMarkup(<NextIntlClientProvider locale="en" messages={{ ...core, ...website, ...admin, ...management }} timeZone="Asia/Dhaka">{node}</NextIntlClientProvider>);
}
