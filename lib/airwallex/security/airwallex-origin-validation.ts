import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { isAllowedOrigin } from "@/lib/auth/origin";

import { requireAirwallexConfig } from "../config/airwallex.config";
import { AirwallexValidationError } from "../errors/airwallex.errors";

export function assertAirwallexInitiationOrigin(request: Request): void {
  if (!isAllowedOrigin(request)) {
    throw new AirwallexValidationError("Request origin is not allowed.");
  }
  const origin = request.headers.get("origin");
  if (!origin) return;

  const expectedOrigin = new URL(requireAirwallexConfig().returnUrl).origin;
  let actualOrigin: string;
  try {
    actualOrigin = new URL(origin).origin;
  } catch {
    throw new AirwallexValidationError("Request origin is not allowed.");
  }
  if (actualOrigin !== expectedOrigin) {
    throw new AirwallexValidationError("Request origin is not allowed.");
  }
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function isAirwallexReconciliationAuthorized(
  request: Request,
  secret: string,
): boolean {
  // Schedulers are server-to-server. A browser Origin is never accepted.
  if (request.headers.has("origin")) return false;
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ") || authorization.length > 512) {
    return false;
  }
  return timingSafeEqual(
    digest(authorization.slice("Bearer ".length)),
    digest(secret),
  );
}
