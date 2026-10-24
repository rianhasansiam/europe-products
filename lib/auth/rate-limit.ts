import "server-only";

import { createHash } from "node:crypto";

import { prisma } from "@/lib/db/prisma";

/**
 * Tiny in-memory fixed-window rate limiter.
 *
 * Good enough for a single-instance deployment and local dev. For a real
 * production rollout, swap this with a shared store (Upstash Redis,
 * Vercel KV, etc.) so limits are enforced across all server instances.
 */

type Bucket = { count: number; resetAt: number };

// Persist across hot reloads in dev so abusive clients can't reset by
// triggering a recompile.
const globalForRateLimit = globalThis as unknown as {
  __rateLimitBuckets?: Map<string, Bucket>;
};

const buckets =
  globalForRateLimit.__rateLimitBuckets ?? new Map<string, Bucket>();

if (process.env.NODE_ENV !== "production") {
  globalForRateLimit.__rateLimitBuckets = buckets;
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until the bucket resets. */
  resetMs: number;
};

const POSTGRES_INTEGER_MAX = 2_147_483_647;
const MAX_RATE_LIMIT_KEY_LENGTH = 4_096;
const MAX_WINDOW_MS = 2_147_483_647;

type DatabaseRateLimitRow = {
  count: number | bigint;
  resetAt: Date;
};

function validateRateLimitArguments(
  key: string,
  max: number,
  windowMs: number,
): void {
  if (
    typeof key !== "string" ||
    key.trim().length === 0 ||
    key.length > MAX_RATE_LIMIT_KEY_LENGTH
  ) {
    throw new TypeError(
      `Rate-limit key must be a non-empty string no longer than ${MAX_RATE_LIMIT_KEY_LENGTH} characters.`,
    );
  }
  if (
    !Number.isSafeInteger(max) ||
    max <= 0 ||
    max >= POSTGRES_INTEGER_MAX
  ) {
    throw new RangeError(
      `Rate-limit max must be an integer between 1 and ${POSTGRES_INTEGER_MAX - 1}.`,
    );
  }
  if (
    !Number.isSafeInteger(windowMs) ||
    windowMs <= 0 ||
    windowMs > MAX_WINDOW_MS
  ) {
    throw new RangeError(
      `Rate-limit window must be an integer between 1 and ${MAX_WINDOW_MS} milliseconds.`,
    );
  }
}

export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, resetMs: windowMs };
  }

  bucket.count += 1;

  if (bucket.count > max) {
    return { allowed: false, remaining: 0, resetMs: bucket.resetAt - now };
  }

  return {
    allowed: true,
    remaining: max - bucket.count,
    resetMs: bucket.resetAt - now,
  };
}

/**
 * Atomic fixed-window rate limiter backed by PostgreSQL.
 *
 * Raw keys are hashed before the query so user IDs, IP addresses, and other
 * caller identity never enter persistent storage. The upsert resets expired
 * windows and caps active-window counters at `max + 1`, which is sufficient to
 * distinguish allowed from blocked requests without risking integer overflow.
 */
export async function rateLimitPersistent(
  key: string,
  max: number,
  windowMs: number,
): Promise<RateLimitResult> {
  validateRateLimitArguments(key, max, windowMs);

  const keyDigest = createHash("sha256").update(key, "utf8").digest("hex");
  const now = new Date();
  const nextResetAt = new Date(now.getTime() + windowMs);

  const rows = await prisma.$queryRaw<DatabaseRateLimitRow[]>`
    INSERT INTO "RateLimitBucket" (
      "keyDigest",
      "count",
      "resetAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (${keyDigest}, 1, ${nextResetAt}, ${now}, ${now})
    ON CONFLICT ("keyDigest") DO UPDATE
    SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
        ELSE LEAST("RateLimitBucket"."count", ${max}) + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${nextResetAt}
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = ${now}
    RETURNING "count", "resetAt"
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("Rate-limit state was not returned by the database.");
  }

  const count = Number(row.count);
  const resetAt =
    row.resetAt instanceof Date ? row.resetAt : new Date(row.resetAt);
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    Number.isNaN(resetAt.getTime())
  ) {
    throw new Error("Rate-limit state returned by the database is invalid.");
  }

  return {
    allowed: count <= max,
    remaining: Math.max(0, max - count),
    resetMs: Math.max(0, resetAt.getTime() - now.getTime()),
  };
}

/**
 * Pulls the best-effort client IP from common proxy headers. Falls back
 * to "unknown" so rate-limit keys still group abusive traffic somewhere.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}
