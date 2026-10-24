import type { Role } from "@/app/generated/prisma/client";
import type { Session } from "next-auth";

/** Session identity guaranteed by our JWT/session callbacks. */
export type AppSessionUser = NonNullable<Session["user"]> & {
  id: string;
  role: Role;
};

export type AppSession = Omit<Session, "user"> & {
  user: AppSessionUser;
};

export type AdminSession = Omit<AppSession, "user"> & {
  user: AppSessionUser & { role: "ADMIN" };
};

export function normalizeRole(value: unknown): Role {
  return value === "ADMIN" ? "ADMIN" : "USER";
}

/**
 * Convert Auth.js' deliberately broad Session type into the application
 * session contract, validating the required user id at the boundary.
 */
export function toAppSession(session: Session | null): AppSession | null {
  if (!session?.user || typeof session.user.id !== "string" || !session.user.id) {
    return null;
  }

  const user = session.user as NonNullable<Session["user"]> & {
    role?: unknown;
  };

  return {
    ...session,
    user: {
      ...user,
      id: session.user.id,
      role: normalizeRole(user.role),
    },
  };
}

export function isAdminSession(session: AppSession): session is AdminSession {
  return session.user.role === "ADMIN";
}
