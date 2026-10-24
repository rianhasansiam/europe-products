/**
 * NextAuth (Auth.js v5) catch-all route handler.
 *
 * Exposes the standard endpoints used by the client helpers from
 * `next-auth/react` (e.g. `signIn`, `signOut`, `/api/auth/session`).
 */
import { handlers } from "@/lib/auth/auth";

export const { GET, POST } = handlers;
