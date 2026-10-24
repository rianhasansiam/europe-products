import { readApiError } from "@/features/http/api-envelope";

/**
 * Client-side helpers for the admin courier fraud-check page.
 *
 * The page lets the admin pull a customer's delivery track record from
 * the couriers (Pathao, Steadfast, Paperfly, Redx, ...) either by
 * clicking an existing order or by typing a phone number manually.
 */

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

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseSummary(entry: unknown): CourierSummary {
  const row = (entry ?? {}) as Partial<CourierSummary>;
  return {
    courier: typeof row.courier === "string" ? row.courier : "Unknown",
    logo: asNullableString(row.logo),
    dataType: asNullableString(row.dataType),
    customerRating: asNullableString(row.customerRating),
    riskLevel: asNullableString(row.riskLevel),
    message: asNullableString(row.message),
    total: toNumber(row.total),
    success: toNumber(row.success),
    cancel: toNumber(row.cancel),
    successRate: toNumber(row.successRate),
  };
}

function parseReport(payload: unknown): CourierReport {
  const envelope = payload as ApiEnvelope<Record<string, unknown>>;
  if (!envelope?.success || !envelope.data) {
    throw new Error("Courier API returned an invalid response.");
  }

  const data = envelope.data;
  const couriers = Array.isArray(data.couriers)
    ? data.couriers.map(parseSummary)
    : [];
  const totals = (data.totals ?? {}) as Partial<CourierTotals>;

  return {
    phone: typeof data.phone === "string" ? data.phone : "",
    couriers,
    totals: {
      total: toNumber(totals.total),
      success: toNumber(totals.success),
      cancel: toNumber(totals.cancel),
      successRate: toNumber(totals.successRate),
      cancelRate: toNumber(totals.cancelRate),
    },
  };
}

export async function checkCourierInfo(phone: string): Promise<CourierReport> {
  const response = await fetch("/api/admin/courier", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    throw new Error("Failed to parse courier response.");
  }

  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to check courier info."));
  }

  return parseReport(payload);
}

/* -------------------------------------------------------------------------- */
/*  Presentation helpers                                                      */
/* -------------------------------------------------------------------------- */

export type RiskTone = "good" | "warn" | "bad" | "neutral";

/**
 * Map an aggregate success rate to a coarse risk tone the UI uses for
 * badge colors. Mirrors the rough thresholds couriers use locally:
 * >=80% is a reliable customer, 50-80% is mixed, below is risky.
 */
export function riskToneFromRate(successRate: number, total: number): RiskTone {
  if (total <= 0) return "neutral";
  if (successRate >= 80) return "good";
  if (successRate >= 50) return "warn";
  return "bad";
}

export function riskLabelFromRate(successRate: number, total: number): string {
  if (total <= 0) return "No history";
  if (successRate >= 80) return "Low risk";
  if (successRate >= 50) return "Medium risk";
  return "High risk";
}

export function formatPercent(value: number, locale = "en"): string {
  return `${value.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

/** Humanise upstream rating slugs like "excellent_customer". */
export function humanise(value: string | null): string | null {
  if (!value) return null;
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
