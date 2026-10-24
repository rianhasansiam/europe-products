import { readApiError } from "@/features/http/api-envelope";

export type ContactMessageStatus = "NEW" | "READ" | "ARCHIVED";

export type AdminMessageRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: ContactMessageStatus;
  createdAt: string;
  updatedAt: string;
};

export type ApiMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  newCount?: number;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: ApiMeta;
};

export const API_PAGE_SIZE = 100;

export const STATUS_VALUES: readonly ContactMessageStatus[] = [
  "NEW",
  "READ",
  "ARCHIVED",
];

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseStatus(value: unknown): ContactMessageStatus {
  if (value === "READ" || value === "ARCHIVED" || value === "NEW") return value;
  return "NEW";
}

function parseRow(entry: unknown): AdminMessageRow {
  const item = (entry ?? {}) as Partial<AdminMessageRow>;
  return {
    id: asString(item.id),
    name: asString(item.name),
    email: asString(item.email),
    phone: asNullableString(item.phone),
    subject: asString(item.subject),
    message: asString(item.message),
    status: parseStatus(item.status),
    createdAt: asString(item.createdAt),
    updatedAt: asString(item.updatedAt),
  };
}

export function parseMessagesPayload(payload: unknown): {
  items: AdminMessageRow[];
  meta: ApiMeta | null;
} {
  const envelope = payload as ApiEnvelope<unknown>;
  if (!envelope?.success || !Array.isArray(envelope.data)) {
    throw new Error("Messages API returned an invalid response.");
  }

  return {
    items: envelope.data.map(parseRow),
    meta: envelope.meta ?? null,
  };
}

/**
 * Walk every page of `/api/admin/messages` and return the full list.
 * Volume is small enough to keep in memory for instant client-side
 * search/filter after the initial sync — same trade-off as customers
 * and orders.
 */
export async function fetchAllAdminMessagesSnapshot(): Promise<AdminMessageRow[]> {
  let page = 1;
  let totalPages = 1;
  const merged: AdminMessageRow[] = [];

  while (page <= totalPages) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(API_PAGE_SIZE),
    });

    const response = await fetch(`/api/admin/messages?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });

    let payload: unknown;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      throw new Error("Failed to parse messages response.");
    }

    if (!response.ok) {
      throw new Error(readApiError(payload, "Failed to load messages."));
    }

    const { items, meta } = parseMessagesPayload(payload);
    merged.push(...items);
    totalPages = meta?.totalPages ?? 1;
    page += 1;
  }

  return merged;
}

export async function patchMessageStatus(
  messageId: string,
  status: ContactMessageStatus,
): Promise<AdminMessageRow> {
  const response = await fetch(`/api/admin/messages/${messageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    // ignore
  }

  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to update message."));
  }

  const envelope = payload as ApiEnvelope<unknown>;
  if (!envelope?.success) {
    throw new Error(readApiError(payload, "Failed to update message."));
  }

  return parseRow(envelope.data);
}

export async function deleteAdminMessage(messageId: string): Promise<void> {
  const response = await fetch(`/api/admin/messages/${messageId}`, {
    method: "DELETE",
    cache: "no-store",
  });

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      // ignore
    }
    throw new Error(readApiError(payload, "Failed to delete message."));
  }
}

export function formatDateTime(value: string | null, locale = "en"): string {
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

export function getInitials(name: string, email: string): string {
  const source = name.trim() || email.trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}
