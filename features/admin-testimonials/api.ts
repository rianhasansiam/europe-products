import { readApiError } from "@/features/http/api-envelope";

export type TestimonialStatus = "ACTIVE" | "INACTIVE";

export type AdminTestimonialRow = {
  id: string;
  name: string;
  location: string | null;
  image: string | null;
  rating: number;
  text: string;
  position: number;
  status: TestimonialStatus;
  createdAt: string;
  updatedAt: string;
};

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

export const STATUS_VALUES: readonly TestimonialStatus[] = [
  "ACTIVE",
  "INACTIVE",
];

export type TestimonialFormState = {
  name: string;
  location: string;
  image: string;
  rating: number;
  text: string;
  position: number;
  status: TestimonialStatus;
};

export const EMPTY_FORM: TestimonialFormState = {
  name: "",
  location: "",
  image: "",
  rating: 5,
  text: "",
  position: 0,
  status: "ACTIVE",
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseStatus(value: unknown): TestimonialStatus {
  return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

function parseRow(entry: unknown): AdminTestimonialRow {
  const item = (entry ?? {}) as Partial<AdminTestimonialRow>;
  return {
    id: asString(item.id),
    name: asString(item.name),
    location: asNullableString(item.location),
    image: asNullableString(item.image),
    rating: Number(item.rating ?? 5),
    text: asString(item.text),
    position: Number(item.position ?? 0),
    status: parseStatus(item.status),
    createdAt: asString(item.createdAt),
    updatedAt: asString(item.updatedAt),
  };
}

export function parseTestimonialsPayload(payload: unknown): {
  items: AdminTestimonialRow[];
  meta: ApiMeta | null;
} {
  const envelope = payload as ApiEnvelope<unknown>;
  if (!envelope?.success || !Array.isArray(envelope.data)) {
    throw new Error("Testimonials API returned an invalid response.");
  }
  return {
    items: envelope.data.map(parseRow),
    meta: envelope.meta ?? null,
  };
}

export async function fetchAllAdminTestimonialsSnapshot(): Promise<
  AdminTestimonialRow[]
> {
  let page = 1;
  let totalPages = 1;
  const merged: AdminTestimonialRow[] = [];

  while (page <= totalPages) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(API_PAGE_SIZE),
    });

    const response = await fetch(
      `/api/admin/testimonials?${params.toString()}`,
      { method: "GET", cache: "no-store" },
    );

    let payload: unknown;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      throw new Error("Failed to parse testimonials response.");
    }

    if (!response.ok) {
      throw new Error(readApiError(payload, "Failed to load testimonials."));
    }

    const { items, meta } = parseTestimonialsPayload(payload);
    merged.push(...items);
    totalPages = meta?.totalPages ?? 1;
    page += 1;
  }

  return merged;
}

type CreateBody = {
  name: string;
  location: string | null;
  image: string | null;
  rating: number;
  text: string;
  position: number;
  status: TestimonialStatus;
};

export async function createTestimonial(
  body: CreateBody,
): Promise<AdminTestimonialRow> {
  const response = await fetch(`/api/admin/testimonials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    // ignore
  }

  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to create testimonial."));
  }

  const envelope = payload as ApiEnvelope<unknown>;
  if (!envelope?.success) {
    throw new Error(readApiError(payload, "Failed to create testimonial."));
  }

  return parseRow(envelope.data);
}

type UpdateBody = Partial<CreateBody>;

export async function updateTestimonial(
  id: string,
  body: UpdateBody,
): Promise<AdminTestimonialRow> {
  const response = await fetch(`/api/admin/testimonials/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    // ignore
  }

  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to update testimonial."));
  }

  const envelope = payload as ApiEnvelope<unknown>;
  if (!envelope?.success) {
    throw new Error(readApiError(payload, "Failed to update testimonial."));
  }

  return parseRow(envelope.data);
}

export async function deleteTestimonial(id: string): Promise<void> {
  const response = await fetch(`/api/admin/testimonials/${id}`, {
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
    throw new Error(readApiError(payload, "Failed to delete testimonial."));
  }
}

export async function createTestimonialFromReview(body: {
  reviewId: string;
  location?: string | null;
}): Promise<AdminTestimonialRow> {
  const response = await fetch(`/api/admin/testimonials/from-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    // ignore
  }

  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to import the review."));
  }

  const envelope = payload as ApiEnvelope<unknown>;
  if (!envelope?.success) {
    throw new Error(readApiError(payload, "Failed to import the review."));
  }

  return parseRow(envelope.data);
}

export function buildFormFromTestimonial(
  testimonial: AdminTestimonialRow,
): TestimonialFormState {
  return {
    name: testimonial.name,
    location: testimonial.location ?? "",
    image: testimonial.image ?? "",
    rating: testimonial.rating,
    text: testimonial.text,
    position: testimonial.position,
    status: testimonial.status,
  };
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
