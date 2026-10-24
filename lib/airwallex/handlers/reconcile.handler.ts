import "server-only";

import { jsonError, ok, tooManyRequests } from "@/lib/api/response";
import { rateLimitPersistent } from "@/lib/auth/rate-limit";

import { requireAirwallexConfig } from "../config/airwallex.config";
import { handleAirwallexApiError } from "../errors/airwallex.errors";
import { isAirwallexReconciliationAuthorized } from "../security/airwallex-origin-validation";
import { reconcileAirwallexPayments } from "../services/airwallex-reconciliation.service";

const RECONCILIATION_RATE_LIMIT = 12;
const RECONCILIATION_RATE_WINDOW_MS = 60_000;

export async function POST(request: Request): Promise<Response> {
  let reconciliationSecret: string;
  try {
    reconciliationSecret = requireAirwallexConfig().reconciliationSecret;
  } catch (error) {
    return handleAirwallexApiError("airwallex.reconcile.config", error);
  }

  if (!isAirwallexReconciliationAuthorized(request, reconciliationSecret)) {
    return jsonError(401, "Unauthorized.");
  }

  try {
    const limit = await rateLimitPersistent(
      "airwallex-reconciliation",
      RECONCILIATION_RATE_LIMIT,
      RECONCILIATION_RATE_WINDOW_MS,
    );
    if (!limit.allowed) return tooManyRequests(limit.resetMs);

    return ok(await reconcileAirwallexPayments());
  } catch (error) {
    return handleAirwallexApiError("airwallex.reconcile.POST", error);
  }
}
