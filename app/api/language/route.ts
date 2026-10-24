import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, ok } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { getPreferenceUserId } from "@/lib/i18n/preferences";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, normalizeLocale } from "@/lib/i18n/registry";
import { getPublishedLanguages } from "@/lib/i18n/server";

const schema = z.object({ locale: z.string().max(64) }).strict();

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const siteOrigin = new URL(process.env.AUTH_URL ?? request.url).origin;
  if ((origin && origin !== siteOrigin) || request.headers.get("sec-fetch-site") === "cross-site") return jsonError(403, "Cross-origin requests are not allowed.");
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) return jsonError(415, "Content-Type must be application/json.");
  let payload: unknown;
  if (!request.body) return jsonError(400, "Invalid JSON payload.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.length;
      if (length > 1_024) { await reader.cancel(); return jsonError(413, "Language preference payload is too large."); }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return jsonError(400, "Invalid JSON payload."); }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return jsonError(400, "Invalid language preference.");
  const locale = normalizeLocale(parsed.data.locale);
  if (!locale || !(await getPublishedLanguages()).some((language) => language.code === locale)) return jsonError(400, "This language is not published.");

  const id = await getPreferenceUserId(request);
  let profilePersisted = false;
  if (id) {
    try {
      await prisma.user.update({ where: { id }, data: { preferredLocale: locale } });
      profilePersisted = true;
    } catch {
      console.error("Language preference was saved in the browser; profile persistence is unavailable.");
    }
  }
  const response = ok({ locale, profilePersisted });
  response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: "lax", httpOnly: true, secure: request.nextUrl.protocol === "https:" });
  return response;
}
