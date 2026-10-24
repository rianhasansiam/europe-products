import { getRequestConfig } from "next-intl/server";
import { getRequestLocale } from "./server";
import { loadMessages } from "./catalogs";

export default getRequestConfig(async ({ locale: override }) => {
  const locale = override ?? await getRequestLocale();
  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: "Asia/Dhaka",
    onError(error) { console.error("Translation rendering failed:", error.code); },
    getMessageFallback() { return "Content unavailable"; },
  };
});
