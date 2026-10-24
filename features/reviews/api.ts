import { readApiData, readApiError } from "@/features/http/api-envelope";

/**
 * Client-side types and fetchers for product reviews.
 *
 * Mirrors `SerializedReview` from `lib/services/review.service` and the
 * `{ data: items, meta: { ...page, summary } }` envelope from
 * `GET /api/reviews`.
 */

export type ReviewSource = "CUSTOMER" | "ADMIN";

export type Review = {
  id: string;
  productId: string;
  authorName: string;
  authorImage: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  source: ReviewSource;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReviewSummary = {
  averageRating: number;
  totalReviews: number;
  distribution: { stars: number; count: number; percentage: number }[];
};

export type ReviewsPage = {
  items: Review[];
  summary: ReviewSummary;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

const EMPTY_SUMMARY: ReviewSummary = {
  averageRating: 0,
  totalReviews: 0,
  distribution: [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: 0,
    percentage: 0,
  })),
};

export async function fetchProductReviews(
  productId: string,
  options?: { page?: number; pageSize?: number },
): Promise<ReviewsPage> {
  const params = new URLSearchParams({ productId });
  if (options?.page) params.set("page", String(options.page));
  if (options?.pageSize) params.set("pageSize", String(options.pageSize));

  const response = await fetch(`/api/reviews?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  let payload: unknown;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    throw new Error("Failed to load reviews.");
  }

  type Envelope = {
    success?: boolean;
    data?: Review[];
    meta?: ReviewsPage["meta"] & { summary?: ReviewSummary };
    error?: string;
    message?: string;
  };
  const envelope = payload as Envelope;

  if (!response.ok || !envelope?.success) {
    throw new Error(readApiError(payload, "Failed to load reviews."));
  }

  const meta = envelope.meta ?? {
    page: 1,
    pageSize: 20,
    total: envelope.data?.length ?? 0,
    totalPages: 1,
  };

  return {
    items: envelope.data ?? [],
    summary: meta.summary ?? EMPTY_SUMMARY,
    meta: {
      page: meta.page,
      pageSize: meta.pageSize,
      total: meta.total,
      totalPages: meta.totalPages,
    },
  };
}

export type CreateReviewPayload = {
  productId: string;
  rating: number;
  title?: string;
  comment?: string;
};

export async function createReview(
  payload: CreateReviewPayload,
): Promise<Review> {
  const response = await fetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  return readApiData<Review>(response, "Failed to submit your review.");
}

export type ReviewableProduct = {
  productId: string;
  productName: string;
  productImage: string | null;
};

export async function fetchReviewableProducts(): Promise<ReviewableProduct[]> {
  const response = await fetch("/api/reviews/reviewable", {
    method: "GET",
    cache: "no-store",
  });

  return readApiData<ReviewableProduct[]>(
    response,
    "Failed to load reviewable products.",
  );
}
