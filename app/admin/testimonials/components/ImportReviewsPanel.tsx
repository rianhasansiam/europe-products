"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useEffect, useMemo, useState } from "react";
import { CheckCircle, Download, Search, X } from "lucide-react";

import {
  createTestimonialFromReview,
  type AdminTestimonialRow,
} from "@/features/admin-testimonials/api";
import {
  fetchAllAdminReviewsSnapshot,
  type AdminReviewRow,
} from "@/features/admin-reviews/api";
import { ButtonLoader, SectionLoader } from "@/components/ui/loading";

import Stars from "@/app/admin/components/Stars";

/**
 * Import-from-reviews panel.
 *
 * Lists customer reviews that have written feedback, hides any that are
 * already promoted (matched by author + text), and lets the admin add
 * one as a testimonial with an optional location override.
 */
export default function ImportReviewsPanel({
  existing,
  onClose,
  onImported,
  onError,
}: {
  existing: AdminTestimonialRow[];
  onClose: () => void;
  onImported: (row: AdminTestimonialRow) => void;
  onError: (message: string) => void;
}) {
  const i18n = useInterfaceTranslations("AdminAdminTestimonialsComponentsImportReviewsPanel");
  const [reviews, setReviews] = useState<AdminReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let ignore = false;
    void (async () => {
      try {
        const rows = await fetchAllAdminReviewsSnapshot();
        if (!ignore) setReviews(rows);
      } catch (loadError) {
        if (!ignore) {
          onError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load reviews.",
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [onError]);

  // Reviews already promoted to a testimonial (best-effort match on
  // author name + quoted text) so we don't offer obvious duplicates.
  const existingKeys = useMemo(() => {
    const set = new Set<string>();
    for (const t of existing) {
      set.add(`${t.name.trim().toLowerCase()}::${t.text.trim().toLowerCase()}`);
    }
    return set;
  }, [existing]);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews.filter((review) => {
      const text = (review.comment ?? review.title ?? "").trim();
      if (text.length < 10) return false; // nothing useful to quote

      const key = `${review.authorName.trim().toLowerCase()}::${text.toLowerCase()}`;
      if (existingKeys.has(key)) return false;
      if (importedIds.has(review.id)) return false;

      if (!q) return true;
      return (
        review.authorName.toLowerCase().includes(q) ||
        text.toLowerCase().includes(q) ||
        (review.product?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [reviews, search, existingKeys, importedIds]);

  const handleImport = async (review: AdminReviewRow) => {
    setBusyId(review.id);
    try {
      const row = await createTestimonialFromReview({
        reviewId: review.id,
        location: locations[review.id]?.trim() || null,
      });
      onImported(row);
      setImportedIds((prev) => new Set(prev).add(review.id));
    } catch (importError) {
      onError(
        importError instanceof Error
          ? importError.message
          : "Failed to import the review.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-900">
            {i18n("Import from customer reviews")}</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {i18n("Promote a real product review to the About page. Already-added reviews are hidden.")}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100"
          aria-label={i18n("Close import panel")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <label className="relative mt-4 flex items-center">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-brand-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={i18n("Search reviews by author, product, text...")}
          className="h-10 w-full rounded-xl border border-brand-border ps-9 pe-3 text-sm outline-none transition focus:border-brand-red"
        />
      </label>

      <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pe-1">
        {loading ? (
          <SectionLoader title={i18n("Loading reviews")} rows={4} />
        ) : candidates.length === 0 ? (
          <div className="rounded-xl border border-brand-border bg-brand-light-bg p-8 text-center text-sm text-gray-600">
            {i18n("No reviews available to import.")}</div>
        ) : (
          candidates.map((review) => {
            const text = (review.comment ?? review.title ?? "").trim();
            const isBusy = busyId === review.id;
            return (
              <div
                key={review.id}
                className="rounded-xl border border-brand-border p-3 sm:p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900">
                    {review.authorName}
                  </span>
                  <Stars rating={review.rating} />
                  {review.verified && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle className="h-3 w-3" />
                      {i18n("Verified")}</span>
                  )}
                  {review.product?.name && (
                    <span className="text-xs text-gray-400">
                      {i18n("on")}{" "}{review.product.name}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm text-gray-600">{text}</p>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={locations[review.id] ?? ""}
                    onChange={(event) =>
                      setLocations((prev) => ({
                        ...prev,
                        [review.id]: event.target.value,
                      }))
                    }
                    placeholder={i18n("Location (optional, e.g. Dhaka)")}
                    className="h-9 flex-1 rounded-lg border border-brand-border px-3 text-xs outline-none transition focus:border-brand-red"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void handleImport(review);
                    }}
                    disabled={isBusy}
                    aria-busy={isBusy}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand-red px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-red-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isBusy ? (
                      <ButtonLoader label={i18n("Adding...")} />
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5" />
                        {i18n("Add to testimonials")}</>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
