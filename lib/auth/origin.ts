import "server-only";

/**
 * Lightweight CSRF defense for custom auth POST endpoints.
 *
 * Auth.js handles CSRF on its own routes; for our hand-rolled endpoints
 * (e.g. /api/auth/register), we reject requests whose Origin doesn't
 * match AUTH_URL. Browsers always set Origin on cross-site POSTs, so
 * this blocks the typical CSRF shape.
 */
export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  // No Origin header = same-origin browser navigation or non-browser
  // client (curl, server-to-server). Allow; the rest of the stack still
  // validates the payload.
  if (!origin) return true;

  const expected = process.env.AUTH_URL;
  if (!expected) return true; // Dev with AUTH_URL unset.

  try {
    return new URL(origin).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}
