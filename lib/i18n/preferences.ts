import "server-only";

import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function getPreferenceUserId(request: NextRequest): Promise<string | null> {
  if (!process.env.AUTH_SECRET) return null;
  try {
    const token = await getToken({ req: request, secret: process.env.AUTH_SECRET, secureCookie: request.nextUrl.protocol === "https:" });
    return typeof token?.id === "string" && token.id ? token.id : null;
  } catch {
    return null;
  }
}

/** A profile is consulted only when the browser has no explicit preference cookie. */
export async function getProfileLocale(request: NextRequest): Promise<string | null> {
  const id = await getPreferenceUserId(request);
  if (!id) return null;
  try {
    const user = await prisma.user.findUnique({ where: { id }, select: { preferredLocale: true } });
    return user?.preferredLocale ?? null;
  } catch {
    // The additive migration may not be deployed yet; English remains usable.
    return null;
  }
}
