import "server-only";

import { ServiceError } from "@/lib/services/service-error";
import type { CourierCheckInput } from "@/lib/validations/courier.validation";

/**
 * Talks to the third-party courier fraud-check API (fraudbd.com).
 *
 * Given a customer's phone number it returns that number's delivery
 * track record across the local couriers (Pathao, Steadfast, Paperfly,
 * Redx, ...) plus an aggregate success / cancellation rate. The admin
 * uses this to gauge how risky a Cash-on-Delivery order is before
 * dispatching it.
 *
 * The API key lives in `CUSTOMER_INFO_CHECKER_API` and never leaves the
 * server — the browser only ever sees the normalised result.
 */

const COURIER_API_URL = "https://fraudbd.com/api/check-courier-info";

export class CourierError extends ServiceError {
  constructor(
    status: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(status, message, details);
    this.name = "CourierError";
  }
}

/* -------------------------------------------------------------------------- */
/*  Normalised shapes returned to the client                                  */
/* -------------------------------------------------------------------------- */

export type CourierSummary = {
  courier: string;
  logo: string | null;
  dataType: string | null;
  customerRating: string | null;
  riskLevel: string | null;
  message: string | null;
  total: number;
  success: number;
  cancel: number;
  successRate: number;
};

export type CourierTotals = {
  total: number;
  success: number;
  cancel: number;
  successRate: number;
  cancelRate: number;
};

export type CourierReport = {
  phone: string;
  couriers: CourierSummary[];
  totals: CourierTotals;
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Normalise a Bangladeshi mobile number to the canonical 11-digit
 * `01XXXXXXXXX` form. Accepts the common ways an admin might paste it:
 * `+8801…`, `8801…`, `01…`, or with spaces / dashes mixed in.
 */
function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  let local = digits;
  if (local.startsWith("88")) local = local.slice(2);
  if (!local.startsWith("0") && local.length === 10) local = `0${local}`;

  if (!/^01\d{9}$/.test(local)) {
    throw new CourierError(
      400,
      "Enter a valid Bangladeshi mobile number (e.g. 017XXXXXXXX).",
    );
  }

  return local;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function rate(success: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((success / total) * 10000) / 100;
}

/**
 * The upstream payload nests each courier under `data.Summaries` keyed
 * by name, with a separate `data.totalSummary`. We flatten that into a
 * predictable array + totals object so the UI never has to branch on
 * the upstream shape (which mixes "rating" and "delivery" rows).
 */
function parseReport(phone: string, payload: unknown): CourierReport {
  const root = (payload ?? {}) as Record<string, unknown>;
  const data = (root.data ?? {}) as Record<string, unknown>;
  const summaries = (data.Summaries ?? {}) as Record<string, unknown>;

  const couriers: CourierSummary[] = Object.entries(summaries).map(
    ([courier, value]) => {
      const row = (value ?? {}) as Record<string, unknown>;
      const total = toNumber(row.total);
      const success = toNumber(row.success);
      const cancel = toNumber(row.cancel);

      return {
        courier,
        logo: asNullableString(row.logo),
        dataType: asNullableString(row.data_type),
        customerRating: asNullableString(row.customer_rating),
        riskLevel: asNullableString(row.risk_level),
        message: asNullableString(row.message),
        total,
        success,
        cancel,
        successRate: rate(success, total),
      };
    },
  );

  const totalSummary = (data.totalSummary ?? {}) as Record<string, unknown>;
  const total = toNumber(totalSummary.total);
  const success = toNumber(totalSummary.success);
  const cancel = toNumber(totalSummary.cancel);

  const totals: CourierTotals = {
    total,
    success,
    cancel,
    successRate:
      totalSummary.successRate != null
        ? toNumber(totalSummary.successRate)
        : rate(success, total),
    cancelRate:
      totalSummary.cancelRate != null
        ? toNumber(totalSummary.cancelRate)
        : rate(cancel, total),
  };

  return { phone, couriers, totals };
}

/* -------------------------------------------------------------------------- */
/*  Public entry point                                                        */
/* -------------------------------------------------------------------------- */

export async function checkCourierInfo(
  input: CourierCheckInput,
): Promise<CourierReport> {
  const apiKey = process.env.CUSTOMER_INFO_CHECKER_API;
  if (!apiKey) {
    throw new CourierError(
      503,
      "Courier check is not configured. Set CUSTOMER_INFO_CHECKER_API.",
    );
  }

  const phone = normalisePhone(input.phone);

  let response: Response;
  try {
    response = await fetch(COURIER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        api_key: apiKey,
      },
      body: JSON.stringify({ phone_number: phone }),
      cache: "no-store",
    });
  } catch {
    throw new CourierError(
      502,
      "Could not reach the courier service. Please try again.",
    );
  }

  let payload: unknown = null;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const record = (payload ?? {}) as Record<string, unknown>;
    const message =
      typeof record.message === "string" && record.message.trim()
        ? record.message
        : "The courier service rejected the request.";
    // 401/403 from upstream means our key is wrong — surface as 502 so we
    // don't imply the admin's own session is unauthenticated.
    const status = response.status === 429 ? 429 : 502;
    throw new CourierError(status, message);
  }

  const record = (payload ?? {}) as Record<string, unknown>;
  if (record.status === false) {
    const message =
      typeof record.message === "string" && record.message.trim()
        ? record.message
        : "No courier history found for this number.";
    throw new CourierError(404, message);
  }

  return parseReport(phone, payload);
}
