import "server-only";

import bcrypt from "bcryptjs";

const BCRYPT_SALT_ROUNDS = 12;

/**
 * Cached bcrypt hash of an arbitrary throwaway password. We compare against
 * this when the user is not found so the response time roughly matches a
 * real password check — mitigates user-enumeration via timing.
 */
let cachedDummyHash: Promise<string> | null = null;
function getDummyHash() {
  if (!cachedDummyHash) {
    cachedDummyHash = bcrypt.hash("__not-a-real-password__", BCRYPT_SALT_ROUNDS);
  }
  return cachedDummyHash;
}

export function hashPassword(plainPassword: string) {
  return bcrypt.hash(plainPassword, BCRYPT_SALT_ROUNDS);
}

/**
 * Compares a plain password to a stored hash. When `hashed` is `null`
 * (e.g. the user does not exist) we still run a real bcrypt comparison
 * against a dummy hash, then return `false`. Keeps timing roughly
 * constant whether the user exists or not.
 */
export async function verifyPassword(
  plainPassword: string,
  hashed: string | null,
): Promise<boolean> {
  if (!hashed) {
    await bcrypt.compare(plainPassword, await getDummyHash());
    return false;
  }
  return bcrypt.compare(plainPassword, hashed);
}
