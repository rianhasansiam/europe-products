import type { NextAuthConfig } from "next-auth";

import { normalizeRole, type AppSessionUser } from "@/lib/auth/session";

/**
 * Edge-safe portion of the NextAuth config. The middleware imports this
 * file and must NOT pull in Prisma or bcrypt (they don't run on the Edge
 * runtime). The full config in `auth.ts` extends this with the Credentials
 * provider's `authorize` callback, which is only used on Node routes.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // Providers are added in auth.ts so the middleware bundle stays small.
  providers: [],
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      if (user) {
        token.id = (user as { id?: string }).id ?? token.id;
        token.role = normalizeRole((user as Partial<AppSessionUser>).role);
      }

      // The `update()` helper from `useSession()` calls back into the
      // jwt callback with `trigger: "update"`, passing whatever object
      // the client sent as `session`. We use it so the navbar's name
      // and avatar can refresh immediately after the user edits their
      // profile, without forcing a sign-out / sign-in round trip.
      if (trigger === "update" && session && typeof session === "object") {
        const updates = session as {
          name?: string;
          image?: string | null;
        };
        if (typeof updates.name === "string" && updates.name) {
          token.name = updates.name;
        }
        if (typeof updates.image === "string") {
          token.picture = updates.image || undefined;
        } else if (updates.image === null) {
          token.picture = undefined;
        }
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        const appUser = session.user as typeof session.user &
          Partial<AppSessionUser>;
        appUser.id = (token.id as string | undefined) ?? "";
        appUser.role = normalizeRole(token.role);
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
