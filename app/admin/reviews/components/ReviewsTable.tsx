"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { MessageSquareText, Phone, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import {
  formatDateTime,
  type AdminReviewRow,
  type ReviewSource,
} from "@/features/admin-reviews/api";
import { LoadingSpinner, TableSkeleton } from "@/components/ui/loading";
import {
  LIST_ITEM_TRANSITION,
  LIST_ITEM_VARIANTS,
} from "@/lib/motion/list-removal";
import { cn } from "@/lib/utils";

import Stars from "@/app/admin/components/Stars";

const SOURCE_BADGE: Record<ReviewSource, string> = {
  CUSTOMER: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ADMIN: "bg-brand-light-bg text-brand-black ring-brand-border",
};

export default function ReviewsTable({
  reviews,
  isLoading,
  totalCount,
  busyId,
  onDelete,
}: {
  reviews: AdminReviewRow[];
  isLoading: boolean;
  totalCount: number;
  busyId: string | null;
  onDelete: (id: string) => void;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminReviewsComponentsReviewsTable");
  if (isLoading && totalCount === 0) {
    return <TableSkeleton rows={6} columns={7} ariaLabel="Loading reviews" />;
  }

  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-border bg-brand-white p-10 text-center text-sm text-gray-600 shadow-sm">
        <MessageSquareText className="mx-auto mb-2 h-8 w-8 text-brand-text-muted" />
        {i18n("No reviews match the current filters.")}</div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-brand-light-bg text-start text-xs uppercase tracking-wider text-brand-text-muted">
            <tr>
              <th className="px-4 py-3">{i18n("Product")}</th>
              <th className="px-4 py-3">{i18n("Author")}</th>
              <th className="px-4 py-3">{i18n("Rating")}</th>
              <th className="px-4 py-3">{i18n("Review")}</th>
              <th className="px-4 py-3">{i18n("Source")}</th>
              <th className="px-4 py-3">{i18n("Date")}</th>
              <th className="px-4 py-3 text-end">{i18n("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
            {reviews.map((review) => {
              const isBusy = busyId === review.id;
              return (
                <motion.tr
                  key={review.id}
                  layout
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={LIST_ITEM_VARIANTS}
                  transition={LIST_ITEM_TRANSITION}
                  className="border-t border-brand-border align-top"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">
                      {review.product?.name ?? "Deleted product"}
                    </p>
                    <p className="mt-1 truncate font-mono text-xs text-brand-text-muted">
                      {review.product?.productCode ?? "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">
                      {review.authorName}
                    </p>
                    {review.authorPhone ? (
                      <a
                        href={`tel:${review.authorPhone}`}
                        className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-brand-black transition hover:text-brand-red hover:underline"
                      >
                        <Phone className="h-3 w-3" />
                        {review.authorPhone}
                      </a>
                    ) : (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-gray-400">
                        <Phone className="h-3 w-3" />
                        {review.source === "ADMIN" ? i18n("Admin-added") : i18n("No phone")}
                      </p>
                    )}
                    {review.verified && (
                      <p className="text-xs text-emerald-600">
                        {i18n("Verified purchase")}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Stars rating={review.rating} />
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    {review.title && (
                      <p className="font-medium text-gray-900">{review.title}</p>
                    )}
                    {review.comment && (
                      <p className="mt-0.5 text-xs text-gray-600">
                        {review.comment}
                      </p>
                    )}
                    {!review.title && !review.comment && (
                      <span className="text-xs text-gray-400">
                        {i18n("No written feedback")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset",
                        SOURCE_BADGE[review.source],
                      )}
                    >
                      {review.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {formatDateTime(review.createdAt, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => onDelete(review.id)}
                        disabled={isBusy}
                        aria-busy={isBusy}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isBusy ? (
                          <LoadingSpinner decorative size="xs" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                        {i18n("Delete")}</button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}
