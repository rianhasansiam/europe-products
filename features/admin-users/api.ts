import { BASE_CURRENCY } from "@/lib/currency/config";
import { readApiError } from "@/features/http/api-envelope";

export type Role = "USER" | "ADMIN";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  image: string | null;
  role: Role;
  termsAcceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
  ordersCount: number;
  liveOrdersCount: number;
  totalSpend: number;
  lastOrderAt: string | null;
};

export type AdminGuestRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  city: string | null;
  address: string;
  postalCode: string | null;
  image: null;
  role: null;
  customerType: "GUEST";
  termsAcceptedAt: null;
  createdAt: string;
  updatedAt: string;
  ordersCount: number;
  liveOrdersCount: number;
  totalSpend: number;
  lastOrderAt: string | null;
};

export type AdminRegisteredCustomerRow = AdminUserRow & {
  customerType: "REGISTERED";
};

export type AdminCustomerRow = AdminRegisteredCustomerRow | AdminGuestRow;
export type CustomerTypeFilter = "ALL" | AdminCustomerRow["customerType"];

export type ApiMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: ApiMeta;
};

export const API_PAGE_SIZE = 100;

export const ROLE_VALUES: readonly Role[] = ["USER", "ADMIN"];

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseRole(value: unknown): Role {
  return value === "ADMIN" ? "ADMIN" : "USER";
}

function parseRow(entry: unknown): AdminUserRow {
  const item = (entry ?? {}) as Partial<AdminUserRow>;
  return {
    id: asString(item.id),
    name: asString(item.name),
    email: asString(item.email),
    phone: asNullableString(item.phone),
    city: asNullableString(item.city),
    image: asNullableString(item.image),
    role: parseRole(item.role),
    termsAcceptedAt: asNullableString(item.termsAcceptedAt),
    createdAt: asString(item.createdAt),
    updatedAt: asString(item.updatedAt),
    ordersCount: Number(item.ordersCount ?? 0),
    liveOrdersCount: Number(item.liveOrdersCount ?? 0),
    totalSpend: Number(item.totalSpend ?? 0),
    lastOrderAt: asNullableString(item.lastOrderAt),
  };
}

export function parseUsersPayload(payload: unknown): {
  items: AdminUserRow[];
  meta: ApiMeta | null;
} {
  const envelope = payload as ApiEnvelope<unknown>;
  if (!envelope?.success || !Array.isArray(envelope.data)) {
    throw new Error("Customers API returned an invalid response.");
  }

  return {
    items: envelope.data.map(parseRow),
    meta: envelope.meta ?? null,
  };
}

export function parseGuestsPayload(payload: unknown): {
  items: AdminGuestRow[];
  meta: ApiMeta | null;
} {
  const envelope = payload as ApiEnvelope<unknown>;
  if (!envelope?.success || !Array.isArray(envelope.data)) {
    throw new Error("Guest customers API returned an invalid response.");
  }

  return {
    items: envelope.data.map((entry) => {
      const item = (entry ?? {}) as Partial<AdminGuestRow>;
      return {
        ...parseRow(entry),
        email: asNullableString(item.email),
        phone: asString(item.phone),
        address: asString(item.address),
        postalCode: asNullableString(item.postalCode),
        image: null,
        role: null,
        customerType: "GUEST" as const,
        termsAcceptedAt: null,
      };
    }),
    meta: envelope.meta ?? null,
  };
}

/**
 * Walk every page of `/api/admin/users` and return the full list.
 * Same trade-off as orders: small enough payloads to keep in memory
 * for instant client-side search/filter after the initial sync.
 */
export async function fetchAllAdminUsersSnapshot(): Promise<AdminUserRow[]> {
  let page = 1;
  let totalPages = 1;
  const merged: AdminUserRow[] = [];

  while (page <= totalPages) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(API_PAGE_SIZE),
    });

    const response = await fetch(`/api/admin/users?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });

    let payload: unknown;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      throw new Error("Failed to parse customers response.");
    }

    if (!response.ok) {
      throw new Error(readApiError(payload, "Failed to load customers."));
    }

    const { items, meta } = parseUsersPayload(payload);
    merged.push(...items);
    totalPages = meta?.totalPages ?? 1;
    page += 1;
  }

  return merged;
}

export async function fetchAllAdminGuestsSnapshot(): Promise<AdminGuestRow[]> {
  let page = 1;
  let totalPages = 1;
  const merged: AdminGuestRow[] = [];

  while (page <= totalPages) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(API_PAGE_SIZE),
    });
    const response = await fetch(`/api/admin/guests?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });

    let payload: unknown;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      throw new Error("Failed to parse guest customers response.");
    }
    if (!response.ok) {
      throw new Error(readApiError(payload, "Failed to load guest customers."));
    }

    const { items, meta } = parseGuestsPayload(payload);
    merged.push(...items);
    totalPages = meta?.totalPages ?? 1;
    page += 1;
  }

  return merged;
}

/** Keep registered-only snapshots available to account-specific controls. */
export async function fetchAllAdminCustomersSnapshot(): Promise<AdminCustomerRow[]> {
  const [users, guests] = await Promise.all([
    fetchAllAdminUsersSnapshot(),
    fetchAllAdminGuestsSnapshot(),
  ]);
  const customers: AdminCustomerRow[] = [
    ...users.map((user) => ({ ...user, customerType: "REGISTERED" as const })),
    ...guests,
  ];
  return customers.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function patchUserRole(
  userId: string,
  role: Role,
): Promise<AdminUserRow> {
  const response = await fetch(`/api/admin/users/${userId}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    // ignore
  }

  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to update role."));
  }

  const envelope = payload as ApiEnvelope<unknown>;
  if (!envelope?.success) {
    throw new Error(readApiError(payload, "Failed to update role."));
  }

  return parseRow(envelope.data);
}

export function formatCurrency(value: number, locale = "en"): string {
  return `${BASE_CURRENCY} ${value.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value: string | null, locale = "en"): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function getInitials(name: string, email: string | null): string {
  const source = name.trim() || (email ?? "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}
