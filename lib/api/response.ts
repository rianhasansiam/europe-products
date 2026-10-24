import "server-only";

import { NextResponse } from "next/server";

/**
 * Uniform JSON envelopes used by every route in `app/api`.
 *
 * Why a single envelope?
 *   - The client never has to branch on response shape.
 *   - Pagination meta (page, total) lives in a predictable place.
 *   - Adding fields later (e.g. `requestId`) is a one-line change here.
 */

export type ApiMeta = {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
};

const PRIVATE_JSON_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  Expires: "0",
  Pragma: "no-cache",
  Vary: "Cookie, Authorization",
  "X-Content-Type-Options": "nosniff",
} as const;

function privateJson(body: unknown, status: number, headers?: HeadersInit) {
  const responseHeaders = new Headers(PRIVATE_JSON_HEADERS);
  new Headers(headers).forEach((value, name) => {
    responseHeaders.set(name, value);
  });

  return NextResponse.json(body, { status, headers: responseHeaders });
}

/** 200 OK with `{ success: true, data, meta? }`. */
export function ok<T>(data: T, meta?: ApiMeta) {
  return privateJson(
    { success: true, data, ...(meta ? { meta } : {}) },
    200,
  );
}

/** 201 Created with `{ success: true, data }`. */
export function created<T>(data: T) {
  return privateJson({ success: true, data }, 201);
}

/** Plain JSON error response with a stable shape. */
export function jsonError(
  status: number,
  error: string,
  extra?: Record<string, unknown>,
) {
  return privateJson({ error, ...extra }, status);
}

/** 429 with a Retry-After header so well-behaved clients can back off. */
export function tooManyRequests(resetMs: number) {
  return privateJson(
    { error: "Too many attempts. Please try again later." },
    429,
    {
      "Retry-After": Math.max(1, Math.ceil(resetMs / 1000)).toString(),
    },
  );
}
