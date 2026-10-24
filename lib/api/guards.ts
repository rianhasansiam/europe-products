import "server-only";

import type { Session } from "next-auth";

import { auth } from "@/lib/auth/auth";
import {
  toAppSession,
  type AdminSession,
  type AppSession,
} from "@/lib/auth/session";
import { jsonError } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

/**
 * Centralized auth gates for protected routes.
 *
 * Returning a discriminated union (instead of throwing) keeps the route
 * handler in normal control flow: caller checks `result.ok` and either
 * returns `result.response` or proceeds with `result.session`.
 *
 *   const guard = await requireAdmin();
 *   if (!guard.ok) return guard.response;
 *   // ...do admin work, guard.session.user.id is available
 */
export type AuthGuard =
  | { ok: true; session: AppSession }
  | { ok: false; response: Response };

export type AdminGuard =
  | { ok: true; session: AdminSession }
  | { ok: false; response: Response };

export async function requireAdmin(): Promise<AdminGuard> {
  // NextAuth's `auth()` is overloaded; the no-arg form returns the session.
  const session = toAppSession((await auth()) as Session | null);

  if (!session) {
    return { ok: false, response: jsonError(401, "Authentication required.") };
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (currentUser?.role !== "ADMIN") {
    return { ok: false, response: jsonError(403, "Admin access only.") };
  }

  const currentSession: AdminSession = {
    ...session,
    user: { ...session.user, role: "ADMIN" },
  };
  return { ok: true, session: currentSession };
}

/**
 * Soft admin check for public routes that should reveal admin-only fields
 * (e.g. `buyingPrice`) when an admin is signed in, without rejecting
 * anonymous/regular callers. Returns a plain boolean.
 */
export async function isAdminRequest(): Promise<boolean> {
  const session = toAppSession((await auth()) as Session | null);
  if (!session) return false;

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  return currentUser?.role === "ADMIN";
}

/** Logged-in users only — no role check. */
export async function requireUser(): Promise<AuthGuard> {
  const session = toAppSession((await auth()) as Session | null);

  if (!session) {
    return { ok: false, response: jsonError(401, "Authentication required.") };
  }

  return { ok: true, session };
}
