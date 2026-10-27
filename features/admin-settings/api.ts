import { BASE_CURRENCY } from "@/lib/currency/config";

import { readApiError } from "@/features/http/api-envelope";

export type PromoCodeStatus = "ACTIVE" | "INACTIVE";
export type PromoDiscountType = "FLAT" | "PERCENT";

export type StoreSettings = {
  id: string;
  taxRate: number;
  standardShippingFee: number;
  expressShippingFee: number;
  freeShippingThreshold: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export type PromoCodeRow = {
  id: string;
  code: string;
  description: string | null;
  discountType: PromoDiscountType;
  value: number;
  minOrder: number | null;
  maxDiscount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  status: PromoCodeStatus;
  createdAt: string;
  updatedAt: string;
};

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: unknown;
};

export const PROMO_STATUS_VALUES: readonly PromoCodeStatus[] = [
  "ACTIVE",
  "INACTIVE",
];
export const DISCOUNT_TYPE_VALUES: readonly PromoDiscountType[] = [
  "FLAT",
  "PERCENT",
];

/* -------------------------------------------------------------------------- */
/*  Form shapes                                                               */
/* -------------------------------------------------------------------------- */

export type SettingsFormState = {
  taxRatePercent: string; // edited as 0..100 percentage for ergonomics
  standardShippingFee: string;
  expressShippingFee: string;
  freeShippingThreshold: string;
  currency: string;
};

export const EMPTY_SETTINGS_FORM: SettingsFormState = {
  taxRatePercent: "5",
  standardShippingFee: "0",
  expressShippingFee: "0",
  freeShippingThreshold: "0",
  currency: BASE_CURRENCY,
};

export type PromoFormState = {
  code: string;
  description: string;
  discountType: PromoDiscountType;
  value: string;
  minOrder: string;
  maxDiscount: string;
  startsAt: string; // datetime-local string, e.g. "2026-05-27T10:00"
  endsAt: string;
  usageLimit: string;
  status: PromoCodeStatus;
};

export const EMPTY_PROMO_FORM: PromoFormState = {
  code: "",
  description: "",
  discountType: "FLAT",
  value: "",
  minOrder: "",
  maxDiscount: "",
  startsAt: "",
  endsAt: "",
  usageLimit: "",
  status: "ACTIVE",
};

/* -------------------------------------------------------------------------- */
/*  Parsers                                                                   */
/* -------------------------------------------------------------------------- */

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parsePromoStatus(value: unknown): PromoCodeStatus {
  return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

function parseDiscountType(value: unknown): PromoDiscountType {
  return value === "PERCENT" ? "PERCENT" : "FLAT";
}

function parseSettings(entry: unknown): StoreSettings {
  const item = (entry ?? {}) as Partial<StoreSettings>;
  return {
    id: asString(item.id),
    taxRate: Number(item.taxRate ?? 0),
    standardShippingFee: Number(item.standardShippingFee ?? 0),
    expressShippingFee: Number(item.expressShippingFee ?? 0),
    freeShippingThreshold: Number(item.freeShippingThreshold ?? 0),
    currency: BASE_CURRENCY,
    createdAt: asString(item.createdAt),
    updatedAt: asString(item.updatedAt),
  };
}

function parsePromoRow(entry: unknown): PromoCodeRow {
  const item = (entry ?? {}) as Partial<PromoCodeRow>;
  return {
    id: asString(item.id),
    code: asString(item.code),
    description: asNullableString(item.description),
    discountType: parseDiscountType(item.discountType),
    value: Number(item.value ?? 0),
    minOrder: asNullableNumber(item.minOrder),
    maxDiscount: asNullableNumber(item.maxDiscount),
    startsAt: asNullableString(item.startsAt),
    endsAt: asNullableString(item.endsAt),
    usageLimit:
      typeof item.usageLimit === "number" ? item.usageLimit : null,
    usedCount: Number(item.usedCount ?? 0),
    status: parsePromoStatus(item.status),
    createdAt: asString(item.createdAt),
    updatedAt: asString(item.updatedAt),
  };
}

/* -------------------------------------------------------------------------- */
/*  HTTP                                                                      */
/* -------------------------------------------------------------------------- */

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export async function fetchStoreSettings(): Promise<StoreSettings> {
  const response = await fetch(`/api/admin/settings`, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to load store settings."));
  }
  const envelope = payload as ApiEnvelope<unknown>;
  return parseSettings(envelope?.data);
}

type SettingsUpdateBody = {
  taxRate?: number;
  standardShippingFee?: number;
  expressShippingFee?: number;
  freeShippingThreshold?: number;
  currency?: string;
};

export async function updateStoreSettings(
  body: SettingsUpdateBody,
): Promise<StoreSettings> {
  const response = await fetch(`/api/admin/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to update store settings."));
  }
  const envelope = payload as ApiEnvelope<unknown>;
  return parseSettings(envelope?.data);
}

export async function fetchPromoCodes(): Promise<PromoCodeRow[]> {
  const response = await fetch(`/api/admin/settings/promo-codes`, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to load promo codes."));
  }
  const envelope = payload as ApiEnvelope<unknown>;
  if (!envelope?.success || !Array.isArray(envelope.data)) {
    throw new Error("Promo codes API returned an invalid response.");
  }
  return envelope.data.map(parsePromoRow);
}

type PromoCreateBody = {
  code: string;
  description: string | null;
  discountType: PromoDiscountType;
  value: number;
  minOrder: number | null;
  maxDiscount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  status: PromoCodeStatus;
};

type PromoUpdateBody = Partial<PromoCreateBody>;

export async function createPromoCode(
  body: PromoCreateBody,
): Promise<PromoCodeRow> {
  const response = await fetch(`/api/admin/settings/promo-codes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to create promo code."));
  }
  const envelope = payload as ApiEnvelope<unknown>;
  return parsePromoRow(envelope?.data);
}

export async function updatePromoCode(
  id: string,
  body: PromoUpdateBody,
): Promise<PromoCodeRow> {
  const response = await fetch(`/api/admin/settings/promo-codes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to update promo code."));
  }
  const envelope = payload as ApiEnvelope<unknown>;
  return parsePromoRow(envelope?.data);
}

export async function deletePromoCode(id: string): Promise<void> {
  const response = await fetch(`/api/admin/settings/promo-codes/${id}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await readJson(response);
    throw new Error(readApiError(payload, "Failed to delete promo code."));
  }
}

/* -------------------------------------------------------------------------- */
/*  Form helpers                                                              */
/* -------------------------------------------------------------------------- */

export function buildSettingsForm(settings: StoreSettings): SettingsFormState {
  return {
    taxRatePercent: ((settings.taxRate ?? 0) * 100).toString(),
    standardShippingFee: String(settings.standardShippingFee ?? 0),
    expressShippingFee: String(settings.expressShippingFee ?? 0),
    freeShippingThreshold: String(settings.freeShippingThreshold ?? 0),
    currency: settings.currency || BASE_CURRENCY,
  };
}

export function buildPromoForm(promo: PromoCodeRow): PromoFormState {
  return {
    code: promo.code,
    description: promo.description ?? "",
    discountType: promo.discountType,
    value: String(promo.value),
    minOrder: promo.minOrder != null ? String(promo.minOrder) : "",
    maxDiscount: promo.maxDiscount != null ? String(promo.maxDiscount) : "",
    startsAt: toDateTimeLocal(promo.startsAt),
    endsAt: toDateTimeLocal(promo.endsAt),
    usageLimit:
      promo.usageLimit != null ? String(promo.usageLimit) : "",
    status: promo.status,
  };
}

/** Convert an ISO date string into the format expected by `<input type="datetime-local">`. */
export function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Convert a `datetime-local` string back to an ISO string (or null). */
export function fromDateTimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function parseNumberField(raw: string, field: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${field} must be a valid number.`);
  }
  if (value < 0) {
    throw new Error(`${field} cannot be negative.`);
  }
  return value;
}

export function parseOptionalNumber(raw: string, field: string): number | null {
  if (!raw.trim()) return null;
  return parseNumberField(raw, field);
}

export function parseOptionalInt(raw: string, field: string): number | null {
  if (!raw.trim()) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative whole number.`);
  }
  return value;
}

export function formatDate(value: string | null | undefined, locale = "en"): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function formatCurrency(value: number, currency: string = BASE_CURRENCY, locale = "en"): string {
  return `${currency} ${value.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
