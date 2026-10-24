import "server-only";

import { jsonError } from "@/lib/api/response";

/**
 * Base class every domain service throws.
 *
 * Route handlers don't need to know which subclass got thrown — they pass
 * the error to `handleServiceError` which maps it to the right HTTP
 * response. Adds two benefits:
 *   - One try/catch shape across cart, order, wishlist, etc.
 *   - Anything that isn't a ServiceError is logged and returned as a
 *     generic 500, so we never leak stack traces or DB errors to clients.
 */
export class ServiceError extends Error {
  status: number;
  details?: Record<string, unknown>;

  constructor(
    status: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ServiceError";
    this.status = status;
    this.details = details;
  }
}

export function handleServiceError(scope: string, error: unknown) {
  if (error instanceof ServiceError) {
    return jsonError(
      error.status,
      error.message,
      error.details ? { details: error.details } : undefined,
    );
  }

  console.error(`[${scope}] failed`, error);

  // In development, surface the underlying error message + scope so the
  // UI can render something actionable instead of the generic copy.
  // In production we still return the generic message so we don't leak
  // stack traces or driver internals to the client.
  if (process.env.NODE_ENV !== "production") {
    const message = error instanceof Error ? error.message : String(error);
    return jsonError(500, `[${scope}] ${message}`, {
      scope,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  return jsonError(500, "Something went wrong. Please try again.");
}
