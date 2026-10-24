"use client";
import { useLocale } from "next-intl";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Star,
  CheckCircle,
  Filter,
  ChevronDown,
  PenLine,
  X,
} from "lucide-react";
import { toast } from "@/lib/feedback";
import { ButtonLoader, SectionLoader } from "@/components/ui/loading";

import {
  createReview,
  fetchProductReviews,
  type Review,
  type ReviewSummary,
} from "@/features/reviews/api";

function avatarFor(review: Review): string {
  if (review.authorImage) return review.authorImage;
  const seed = encodeURIComponent(review.authorName || "Customer");
  return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}`;
}

function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const EMPTY_SUMMARY: ReviewSummary = {
  averageRating: 0,
  totalReviews: 0,
  distribution: [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: 0,
    percentage: 0,
  })),
};

type SortKey = "newest" | "rating";

/**
 * Customer reviews for a product. Self-contained client component:
 * fetches `/api/reviews?productId=...` on mount, renders the rating
 * overview + list, and lets a logged-in buyer submit a review. The
 * server enforces that only customers with a DELIVERED order can post,
 * so eligibility errors surface inline here.
 */
export default function ReviewSection({ productId }: { productId: string }) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("InterfaceProductsSlugComponentsReviewSection");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [showForm, setShowForm] = useState(false);

  const loadReviews = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setLoadError(null);
    try {
      const page = await fetchProductReviews(productId, { pageSize: 100 });
      setReviews(page.items);
      setSummary(page.summary);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load reviews.",
      );
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReviews();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReviews]);

  const visibleReviews = useMemo(() => {
    const filtered = filterRating
      ? reviews.filter((review) => review.rating === filterRating)
      : reviews;
    const sorted = [...filtered];
    if (sortBy === "rating") {
      sorted.sort((a, b) => b.rating - a.rating);
    } else {
      sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return sorted;
  }, [filterRating, reviews, sortBy]);

  return (
    <div className="min-w-0 space-y-8">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex min-w-0 items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl">
          <span className="h-6 w-1.5 shrink-0 rounded-full bg-brand-red" />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {i18n("Customer Reviews")}</span>
        </h2>
        <button
          onClick={() => setShowForm((open) => !open)}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-red px-4 py-2 text-sm font-medium text-brand-white shadow-lg transition-all hover:bg-brand-red-hover sm:w-auto"
        >
          {showForm ? (
            <X className="w-4 h-4" />
          ) : (
            <PenLine className="w-4 h-4" />
          )}
          {showForm ? i18n("Close") : i18n("Write a Review")}
        </button>
      </div>

      {showForm && (
        <WriteReviewForm
          productId={productId}
          onSubmitted={() => {
            setShowForm(false);
            void loadReviews();
          }}
        />
      )}

      {/* Rating Overview */}
      <div className="bg-white rounded-2xl border border-brand-border p-4 sm:p-6">
        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {/* Average Rating */}
          <div className="text-center md:text-start md:border-e md:border-brand-border md:pe-8">
            <div className="text-4xl sm:text-5xl font-bold text-brand-black mb-2">
              {summary.averageRating.toFixed(1)}
            </div>
            <div className="flex items-center justify-center md:justify-start gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-5 h-5 ${
                    star <= Math.round(summary.averageRating)
                      ? "fill-brand-gold text-brand-gold"
                      : "text-gray-200"
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-gray-500">
              {i18n("Based on {count, plural, one {# review} other {# reviews}}", { count: summary.totalReviews })}
            </p>
          </div>

          {/* Rating Distribution */}
          <div className="space-y-2">
            {summary.distribution.map((item) => (
              <button
                key={item.stars}
                onClick={() =>
                  setFilterRating(
                    filterRating === item.stars ? null : item.stars,
                  )
                }
                className={`w-full flex items-center gap-3 p-1.5 rounded-lg transition-all ${
                  filterRating === item.stars
                    ? "bg-brand-red/10"
                    : "hover:bg-gray-50"
                }`}
              >
                <span className="text-sm text-gray-600 w-8">{item.stars}★</span>
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-red rounded-full transition-all"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <span className="text-sm text-gray-500 w-12 text-end">
                  {item.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters & Sort */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="min-w-0 text-sm text-gray-500 [overflow-wrap:anywhere]">
            {filterRating
              ? i18n("Showing {rating}-star reviews", { rating: filterRating })
              : i18n("All {count, plural, one {# review} other {# reviews}}", { count: visibleReviews.length })}
          </span>
          {filterRating && (
            <button
              onClick={() => setFilterRating(null)}
              className="text-sm text-brand-red hover:underline"
            >
              {i18n("Clear filter")}</button>
          )}
        </div>
        <div className="relative">
          <select
            aria-label={i18n("Sort reviews")}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="appearance-none ps-3 pe-8 py-2 bg-white border border-brand-border rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-red"
          >
            <option value="newest">{i18n("Newest First")}</option>
            <option value="rating">{i18n("Highest Rated")}</option>
          </select>
          <ChevronDown className="absolute end-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* States */}
      {loading ? (
        <SectionLoader title={i18n("Loading reviews")} rows={5} />
      ) : loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {loadError}
        </div>
      ) : visibleReviews.length === 0 ? (
        <div className="rounded-xl border border-brand-border bg-white p-10 text-center text-sm text-gray-600">
          {reviews.length === 0
            ? i18n("No reviews yet. Be the first to review this product after it is delivered.")
            : i18n("No reviews match the current filter.")}
        </div>
      ) : (
        <div className="space-y-4">
          {visibleReviews.map((review) => (
            <div
              key={review.id}
              className="min-w-0 rounded-xl border border-brand-border bg-white p-4 transition-shadow hover:shadow-md sm:p-5"
            >
              <div className="flex items-start gap-4">
                <div
                  className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 bg-brand-light-bg"
                  style={{ position: "relative" }}
                >
                  <Image
                    src={avatarFor(review)}
                    alt={review.authorName}
                    fill
                    unoptimized
                    sizes="40px"
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="min-w-0 font-semibold text-gray-900 [overflow-wrap:anywhere]">
                      {review.authorName}
                    </span>
                    {review.verified && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle className="w-3 h-3" />
                        {i18n("Verified Purchase")}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= review.rating
                              ? "fill-brand-gold text-brand-gold"
                              : "text-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatDate(review.createdAt, locale)}
                    </span>
                  </div>
                </div>
              </div>

              {(review.title || review.comment) && (
                <div className="mt-3">
                  {review.title && (
                    <h4 className="font-medium text-gray-900 [overflow-wrap:anywhere]">
                      {review.title}
                    </h4>
                  )}
                  {review.comment && (
                    <p className="mt-1 text-sm leading-relaxed text-gray-600 [overflow-wrap:anywhere]">
                      {review.comment}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WriteReviewForm({
  productId,
  onSubmitted,
}: {
  productId: string;
  onSubmitted: () => void;
}) {
  const i18n = useInterfaceTranslations("InterfaceProductsSlugComponentsReviewSection");
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createReview({
        productId,
        rating,
        title: title.trim() || undefined,
        comment: comment.trim() || undefined,
      });
      setDone(true);
      toast.success(i18n("Review submitted — thanks!"));
      // Give the success note a beat before refreshing the list.
      setTimeout(onSubmitted, 800);
    } catch (submitError) {
      const msg =
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit your review.";
      setError(msg);
      toast.error(i18n(msg));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700">
        <span className="inline-flex items-center gap-2 font-medium">
          <CheckCircle className="w-4 h-4" />
          {i18n("Thanks! Your review has been posted.")}</span>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="min-w-0 rounded-2xl border border-brand-border bg-white p-4 sm:p-5"
    >
      <h3 className="text-base font-bold text-gray-900">
        {i18n("Share your experience")}</h3>
      <p className="mt-0.5 text-xs text-gray-500">
        {i18n("You can review a product once it has been delivered to you.")}</p>

      <div className="mt-4 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5"
            aria-label={i18n("{count, plural, one {# star} other {# stars}}", { count: star })}
          >
            <Star
              className={`w-6 h-6 transition-colors ${
                star <= (hover || rating)
                  ? "fill-brand-gold text-brand-gold"
                  : "text-gray-300"
              }`}
            />
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={i18n("Title (optional)")}
          maxLength={120}
          className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm text-gray-900 outline-none transition focus:border-brand-red"
        />
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder={i18n("Tell others what you liked or disliked (optional)")}
          rows={3}
          maxLength={2000}
          className="w-full rounded-xl border border-brand-border px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-red"
        />
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 [overflow-wrap:anywhere]">
          {i18n(error)}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-red text-brand-white text-sm font-medium rounded-xl hover:bg-brand-red-hover transition-all shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <ButtonLoader label={i18n("Submitting...")} />
          ) : (
            i18n("Submit review")
          )}
        </button>
      </div>
    </form>
  );
}
