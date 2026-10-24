/**
 * Single source of truth for auth field rules.
 * Used by both the Zod schemas (server) and the form hooks (client) so the
 * UI never lets a user "Continue" past rules the server will then reject.
 *
 * NOTE: PASSWORD_MAX is 72 because bcrypt silently truncates inputs longer
 * than 72 bytes, which would otherwise let two different long passwords
 * hash to the same value.
 */
export const FIELD_LIMITS = {
  NAME_MIN: 2,
  NAME_MAX: 80,
  EMAIL_MAX: 254, // RFC 5321 practical limit
  PHONE_MIN: 7,
  PHONE_MAX: 20,
  CITY_MIN: 2,
  CITY_MAX: 100,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 72,
} as const;

/** Allows digits, spaces, hyphens, parentheses, and a single leading "+". */
export const PHONE_REGEX = /^\+?[0-9\s\-()]+$/;

/**
 * Email shape check used by the UI for early feedback only.
 * The server uses Zod's `z.email()` as the authoritative gate.
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function meetsPasswordPolicy(password: string): boolean {
  return (
    password.length >= FIELD_LIMITS.PASSWORD_MIN &&
    password.length <= FIELD_LIMITS.PASSWORD_MAX &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password)
  );
}
