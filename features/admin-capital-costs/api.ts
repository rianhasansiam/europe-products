import { BASE_CURRENCY } from "@/lib/currency/config";
import { readApiError } from "@/features/http/api-envelope";

/**
 * Client API for the Admin Capital & Cost Tracker.
 *
 * Mirrors `lib/services/capital-cost.service.ts` shapes. All requests hit
 * the admin-guarded `/api/admin/capital-costs/*` routes with
 * `cache: "no-store"` so the admin always sees fresh figures. This module
 * is ADMIN-ONLY and isolated from the rest of the storefront.
 */

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type CapitalRecord = {
  id: string;
  amount: number;
  currency: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OtherCostRow = {
  id: string;
  amount: number;
  currency: string;
  reason: string;
  description: string | null;
  costDate: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductCostItem = {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  status: "ACTIVE" | "INACTIVE";
  buyingPrice: number;
  totalUnits: number;
  totalCost: number;
  selectedAt: string;
};

export type ProductCostOption = {
  id: string;
  productCode: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  buyingPrice: number;
  totalUnits: number;
  totalCost: number;
};

export type ProductCostSummary = {
  totalProductCost: number;
  productCount: number;
  totalUnits: number;
  items: ProductCostItem[];
};

export type CapitalCostSummary = {
  totalCapital: number;
  productCosts: number;
  otherCosts: number;
  allCosts: number;
  remainingBalance: number;
};

export type CapitalCostOverview = {
  capital: CapitalRecord | null;
  productCost: ProductCostSummary;
  otherCosts: { items: OtherCostRow[]; total: number };
  summary: CapitalCostSummary;
  activity: ActivityRow[];
};

export type ActivityKind =
  | "CAPITAL_SET"
  | "CAPITAL_UPDATED"
  | "CAPITAL_ADDED"
  | "PRODUCT_COST_ADDED"
  | "PRODUCT_COST_REMOVED"
  | "COST_CREATED"
  | "COST_UPDATED"
  | "COST_DELETED";

export type ActivityRow = {
  id: string;
  type: ActivityKind;
  description: string;
  amount: number | null;
  currency: string;
  note: string | null;
  entityId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: string;
};

export type CapitalFormState = {
  amount: string;
  note: string;
};

export type OtherCostFormState = {
  reason: string;
  amount: string;
  /** `<input type="datetime-local">` value, e.g. "2026-06-15T14:30". */
  costDate: string;
  description: string;
};

export type OtherCostFilters = {
  search: string;
  /** `<input type="date">` value, e.g. "2026-06-15". */
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
};

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
};

/* -------------------------------------------------------------------------- */
/*  Empty states / form builders                                              */
/* -------------------------------------------------------------------------- */

export const EMPTY_CAPITAL_FORM: CapitalFormState = { amount: "", note: "" };

export const EMPTY_OTHER_COST_FILTERS: OtherCostFilters = {
  search: "",
  dateFrom: "",
  dateTo: "",
  minAmount: "",
  maxAmount: "",
};

export function buildCapitalForm(
  capital: CapitalRecord | null,
): CapitalFormState {
  return {
    amount: capital ? String(capital.amount) : "",
    note: capital?.note ?? "",
  };
}

export function emptyOtherCostForm(): OtherCostFormState {
  return {
    reason: "",
    amount: "",
    costDate: toDateTimeLocal(new Date().toISOString()),
    description: "",
  };
}

export function buildOtherCostForm(cost: OtherCostRow): OtherCostFormState {
  return {
    reason: cost.reason,
    amount: String(cost.amount),
    costDate: toDateTimeLocal(cost.costDate),
    description: cost.description ?? "",
  };
}

/* -------------------------------------------------------------------------- */
/*  Parsing / formatting helpers                                              */
/* -------------------------------------------------------------------------- */

/** Parse a positive money amount from a text input, throwing on bad input. */
export function parsePositiveAmount(value: string, label: string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw new Error(`${label} must be a valid number.`);
  }
  if (amount <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** ISO string → `<input type="datetime-local">` value (local time). */
export function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/** `<input type="datetime-local">` value → ISO string, or null when empty. */
export function fromDateTimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function formatCurrency(value: number, currency: string = BASE_CURRENCY, locale = "en"): string {
  const safe = Number.isFinite(value) ? value : 0;
  const rounded = Math.round((safe + Number.EPSILON) * 100) / 100;
  const hasFraction = Math.abs(rounded % 1) > 0.0001;
  return `${currency} ${rounded.toLocaleString(locale, {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDateTime(value: string | null | undefined, locale = "en"): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* -------------------------------------------------------------------------- */
/*  Response parsing                                                          */
/* -------------------------------------------------------------------------- */

async function parseEnvelope<T>(
  response: Response,
  fallbackError: string,
): Promise<ApiEnvelope<T>> {
  let payload: unknown = null;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    throw new Error(fallbackError);
  }

  const envelope = payload as ApiEnvelope<T>;
  if (!response.ok || !envelope?.success) {
    throw new Error(readApiError(payload, fallbackError));
  }
  return envelope;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseCapital(entry: unknown): CapitalRecord | null {
  if (!entry || typeof entry !== "object") return null;
  const item = entry as Partial<CapitalRecord>;
  return {
    id: asString(item.id),
    amount: asNumber(item.amount),
    currency: asString(item.currency) || "BDT",
    note: asNullableString(item.note),
    createdAt: asString(item.createdAt),
    updatedAt: asString(item.updatedAt),
  };
}

function parseOtherCost(entry: unknown): OtherCostRow {
  const item = (entry ?? {}) as Partial<OtherCostRow>;
  return {
    id: asString(item.id),
    amount: asNumber(item.amount),
    currency: asString(item.currency) || "BDT",
    reason: asString(item.reason),
    description: asNullableString(item.description),
    costDate: asString(item.costDate),
    createdAt: asString(item.createdAt),
    updatedAt: asString(item.updatedAt),
  };
}

function parseProductCost(entry: unknown): ProductCostSummary {
  const item = (entry ?? {}) as Partial<ProductCostSummary>;
  return {
    totalProductCost: asNumber(item.totalProductCost),
    productCount: asNumber(item.productCount),
    totalUnits: asNumber(item.totalUnits),
    items: Array.isArray(item.items) ? item.items.map(parseProductCostItem) : [],
  };
}

function parseProductCostStatus(value: unknown): "ACTIVE" | "INACTIVE" {
  return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

function parseProductCostItem(entry: unknown): ProductCostItem {
  const item = (entry ?? {}) as Partial<ProductCostItem>;
  return {
    id: asString(item.id),
    productId: asString(item.productId),
    productCode: asString(item.productCode),
    productName: asString(item.productName),
    status: parseProductCostStatus(item.status),
    buyingPrice: asNumber(item.buyingPrice),
    totalUnits: asNumber(item.totalUnits),
    totalCost: asNumber(item.totalCost),
    selectedAt: asString(item.selectedAt),
  };
}

function parseProductCostOption(entry: unknown): ProductCostOption {
  const item = (entry ?? {}) as Partial<ProductCostOption>;
  return {
    id: asString(item.id),
    productCode: asString(item.productCode),
    name: asString(item.name),
    status: parseProductCostStatus(item.status),
    buyingPrice: asNumber(item.buyingPrice),
    totalUnits: asNumber(item.totalUnits),
    totalCost: asNumber(item.totalCost),
  };
}

function parseSummary(entry: unknown): CapitalCostSummary {
  const item = (entry ?? {}) as Partial<CapitalCostSummary>;
  return {
    totalCapital: asNumber(item.totalCapital),
    productCosts: asNumber(item.productCosts),
    otherCosts: asNumber(item.otherCosts),
    allCosts: asNumber(item.allCosts),
    remainingBalance: asNumber(item.remainingBalance),
  };
}

const ACTIVITY_KINDS: readonly ActivityKind[] = [
  "CAPITAL_SET",
  "CAPITAL_UPDATED",
  "CAPITAL_ADDED",
  "PRODUCT_COST_ADDED",
  "PRODUCT_COST_REMOVED",
  "COST_CREATED",
  "COST_UPDATED",
  "COST_DELETED",
];

function parseActivityKind(value: unknown): ActivityKind {
  return ACTIVITY_KINDS.includes(value as ActivityKind)
    ? (value as ActivityKind)
    : "COST_UPDATED";
}

function parseActivity(entry: unknown): ActivityRow {
  const item = (entry ?? {}) as Partial<ActivityRow>;
  return {
    id: asString(item.id),
    type: parseActivityKind(item.type),
    currency: asString(item.currency) || "BDT",
    description: asString(item.description),
    amount:
      item.amount === null || item.amount === undefined
        ? null
        : asNumber(item.amount),
    note: asNullableString(item.note),
    entityId: asNullableString(item.entityId),
    actorName: asNullableString(item.actorName),
    actorEmail: asNullableString(item.actorEmail),
    createdAt: asString(item.createdAt),
  };
}

/* -------------------------------------------------------------------------- */
/*  API calls                                                                 */
/* -------------------------------------------------------------------------- */

export async function fetchCapitalCostOverview(): Promise<CapitalCostOverview> {
  const response = await fetch("/api/admin/capital-costs/overview", {
    method: "GET",
    cache: "no-store",
  });
  const envelope = await parseEnvelope<unknown>(
    response,
    "Failed to load capital & cost data.",
  );

  const data = (envelope.data ?? {}) as {
    capital?: unknown;
    productCost?: unknown;
    otherCosts?: { items?: unknown; total?: unknown };
    summary?: unknown;
    activity?: unknown;
  };

  const items = Array.isArray(data.otherCosts?.items)
    ? data.otherCosts.items.map(parseOtherCost)
    : [];

  const activity = Array.isArray(data.activity)
    ? data.activity.map(parseActivity)
    : [];

  return {
    capital: parseCapital(data.capital),
    productCost: parseProductCost(data.productCost),
    otherCosts: { items, total: asNumber(data.otherCosts?.total) },
    summary: parseSummary(data.summary),
    activity,
  };
}

export async function fetchProductCostOptions(): Promise<ProductCostOption[]> {
  const response = await fetch("/api/admin/capital-costs/product-costs", {
    method: "GET",
    cache: "no-store",
  });
  const envelope = await parseEnvelope<unknown>(
    response,
    "Failed to load products.",
  );
  return Array.isArray(envelope.data)
    ? envelope.data.map(parseProductCostOption)
    : [];
}

export async function addProductCosts(
  productIds: string[],
): Promise<ProductCostSummary> {
  const response = await fetch("/api/admin/capital-costs/product-costs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productIds }),
    cache: "no-store",
  });
  const envelope = await parseEnvelope<unknown>(
    response,
    "Failed to add selected product costs.",
  );
  return parseProductCost(envelope.data);
}

export async function removeProductCost(id: string): Promise<{ id: string }> {
  const response = await fetch(`/api/admin/capital-costs/product-costs/${id}`, {
    method: "DELETE",
    cache: "no-store",
  });
  const envelope = await parseEnvelope<{ id?: string }>(
    response,
    "Failed to remove product cost.",
  );
  return { id: asString(envelope.data?.id) || id };
}

export async function addCapital(body: {
  amount: number;
  note: string | null;
}): Promise<CapitalRecord> {
  const response = await fetch("/api/admin/capital-costs/capital", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const envelope = await parseEnvelope<unknown>(
    response,
    "Failed to add capital.",
  );
  const capital = parseCapital(envelope.data);
  if (!capital) throw new Error("Failed to add capital.");
  return capital;
}

export async function fetchOtherCosts(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: string;
  maxAmount?: string;
}): Promise<{ items: OtherCostRow[]; filteredTotalAmount: number }> {
  const search = new URLSearchParams();
  search.set("page", String(params.page ?? 1));
  search.set("pageSize", String(params.pageSize ?? 100));
  if (params.search?.trim()) search.set("search", params.search.trim());
  if (params.dateFrom) search.set("dateFrom", params.dateFrom);
  if (params.dateTo) search.set("dateTo", params.dateTo);
  if (params.minAmount) search.set("minAmount", params.minAmount);
  if (params.maxAmount) search.set("maxAmount", params.maxAmount);

  const response = await fetch(
    `/api/admin/capital-costs/other-costs?${search.toString()}`,
    { method: "GET", cache: "no-store" },
  );
  const envelope = await parseEnvelope<unknown>(
    response,
    "Failed to load cost records.",
  );

  const items = Array.isArray(envelope.data)
    ? envelope.data.map(parseOtherCost)
    : [];
  const filteredTotalAmount = asNumber(envelope.meta?.filteredTotalAmount);

  return { items, filteredTotalAmount };
}

type OtherCostBody = {
  amount: number;
  reason: string;
  description: string | null;
  costDate: string;
};

export async function createOtherCost(
  body: OtherCostBody,
): Promise<OtherCostRow> {
  const response = await fetch("/api/admin/capital-costs/other-costs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const envelope = await parseEnvelope<unknown>(
    response,
    "Failed to add cost record.",
  );
  return parseOtherCost(envelope.data);
}

export async function updateOtherCost(
  id: string,
  body: OtherCostBody,
): Promise<OtherCostRow> {
  const response = await fetch(`/api/admin/capital-costs/other-costs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const envelope = await parseEnvelope<unknown>(
    response,
    "Failed to update cost record.",
  );
  return parseOtherCost(envelope.data);
}

export async function deleteOtherCost(id: string): Promise<{ id: string }> {
  const response = await fetch(`/api/admin/capital-costs/other-costs/${id}`, {
    method: "DELETE",
    cache: "no-store",
  });
  const envelope = await parseEnvelope<{ id?: string }>(
    response,
    "Failed to delete cost record.",
  );
  return { id: asString(envelope.data?.id) || id };
}
