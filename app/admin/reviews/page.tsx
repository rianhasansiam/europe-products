"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  prependAdminReview,
  removeAdminReview,
  setAdminReviews,
  setAdminReviewsError,
  setAdminReviewsLoading,
} from "@/store/slices/admin-reviews.slice";
import type { AppDispatch, RootState } from "@/store";
import {
  deleteAdminReview,
  fetchAllAdminReviewsSnapshot,
  type ReviewSource,
} from "@/features/admin-reviews/api";
import {
  confirmMajorAction,
  notifyActionError,
  notifyActionSuccess,
} from "@/lib/admin-feedback";
import { useAnimatedRemoval } from "@/hooks/useAnimatedRemoval";

import ReviewSummaryCards from "./components/ReviewSummaryCards";
import ReviewsToolbar from "./components/ReviewsToolbar";
import ReviewsTable from "./components/ReviewsTable";
import AddReviewForm from "./components/AddReviewForm";

type SourceFilter = "ALL" | ReviewSource;
type RatingFilter = "ALL" | 1 | 2 | 3 | 4 | 5;

export default function AdminReviewsPage() {
  const i18n = useInterfaceTranslations("AdminAdminReviewsPage");
  const dispatch = useDispatch<AppDispatch>();
  const reviews = useSelector((state: RootState) => state.adminReviews.items);
  const isLoading = useSelector(
    (state: RootState) => state.adminReviews.isLoading,
  );
  const isHydrated = useSelector(
    (state: RootState) => state.adminReviews.isHydrated,
  );
  const error = useSelector((state: RootState) => state.adminReviews.error);

  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("ALL");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const { visibleItems: animatedReviews, queueRemoval: queueReviewRemoval } =
    useAnimatedRemoval({
      items: reviews,
      getId: (review) => review.id,
    });

  const refreshReviews = useCallback(async () => {
    dispatch(setAdminReviewsLoading(true));
    dispatch(setAdminReviewsError(null));
    try {
      const items = await fetchAllAdminReviewsSnapshot();
      dispatch(setAdminReviews(items));
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load reviews.";
      dispatch(setAdminReviewsError(message));
    } finally {
      dispatch(setAdminReviewsLoading(false));
    }
  }, [dispatch]);

  useEffect(() => {
    if (isHydrated) return;
    void refreshReviews();
  }, [isHydrated, refreshReviews]);

  const visibleReviews = useMemo(() => {
    const q = query.trim().toLowerCase();
    return animatedReviews.filter((review) => {
      const matchQuery =
        !q ||
        review.authorName.toLowerCase().includes(q) ||
        (review.authorPhone ?? "").toLowerCase().includes(q) ||
        (review.title ?? "").toLowerCase().includes(q) ||
        (review.comment ?? "").toLowerCase().includes(q) ||
        (review.product?.name ?? "").toLowerCase().includes(q);

      const matchSource =
        sourceFilter === "ALL" || review.source === sourceFilter;
      const matchRating =
        ratingFilter === "ALL" || review.rating === ratingFilter;

      return matchQuery && matchSource && matchRating;
    });
  }, [animatedReviews, query, ratingFilter, sourceFilter]);

  const stats = useMemo(() => {
    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const average = total > 0 ? Math.round((sum / total) * 10) / 10 : 0;
    const adminCount = reviews.filter((r) => r.source === "ADMIN").length;
    return { total, average, adminCount };
  }, [reviews]);

  const handleDelete = async (id: string) => {
    const confirmed = await confirmMajorAction({
      title: i18n("Delete this review?"),
      description: i18n("This action cannot be undone."),
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;

    queueReviewRemoval(
      id,
      async () => {
        setMutationError(null);
        setSuccessNote(null);
        setBusyId(id);
        try {
          await deleteAdminReview(id);
          dispatch(removeAdminReview(id));
          setSuccessNote("Review deleted.");
          notifyActionSuccess("Review deleted.");
        } catch (mutation) {
          const message =
            mutation instanceof Error
              ? mutation.message
              : "Failed to delete the review.";
          setMutationError(message);
          throw new Error(message);
        } finally {
          setBusyId(null);
        }
      },
      (error) => {
        notifyActionError(error, "Failed to delete the review.");
      },
    );
  };

  return (
    <section className="space-y-4">
      <ReviewSummaryCards
        total={stats.total}
        average={stats.average}
        adminCount={stats.adminCount}
      />

      <ReviewsToolbar
        query={query}
        sourceFilter={sourceFilter}
        ratingFilter={ratingFilter}
        visibleCount={visibleReviews.length}
        totalCount={reviews.length}
        isLoading={isLoading}
        showAddForm={showAddForm}
        onQueryChange={setQuery}
        onSourceChange={setSourceFilter}
        onRatingChange={setRatingFilter}
        onToggleAddForm={() => {
          setShowAddForm((open) => !open);
          setMutationError(null);
          setSuccessNote(null);
        }}
        onRefresh={() => {
          void refreshReviews();
        }}
      />

      {showAddForm && (
        <AddReviewForm
          onCancel={() => setShowAddForm(false)}
          onCreated={(review) => {
            dispatch(prependAdminReview(review));
            setShowAddForm(false);
            const message = `Review added for ${review.product?.name ?? "product"}.`;
            setSuccessNote(message);
            notifyActionSuccess(message);
          }}
          onError={(message) => {
            setMutationError(message);
            notifyActionError(message, "Failed to add the review.");
          }}
        />
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {i18n(error)}
        </div>
      )}

      {mutationError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {mutationError}
        </div>
      )}

      {successNote && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {successNote}
        </div>
      )}

      <ReviewsTable
        reviews={visibleReviews}
        isLoading={isLoading}
        totalCount={reviews.length}
        busyId={busyId}
        onDelete={(id) => {
          void handleDelete(id);
        }}
      />
    </section>
  );
}
