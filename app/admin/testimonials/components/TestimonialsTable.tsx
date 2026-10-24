"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { MessageSquareQuote, Pencil, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import {
  formatDate,
  type AdminTestimonialRow,
  type TestimonialStatus,
} from "@/features/admin-testimonials/api";
import { LoadingSpinner, TableSkeleton } from "@/components/ui/loading";
import {
  LIST_ITEM_TRANSITION,
  LIST_ITEM_VARIANTS,
} from "@/lib/motion/list-removal";
import { cn } from "@/lib/utils";

import Stars from "@/app/admin/components/Stars";

const STATUS_BADGE: Record<TestimonialStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  INACTIVE: "bg-gray-100 text-gray-600 ring-gray-200",
};

export default function TestimonialsTable({
  testimonials,
  isLoading,
  totalCount,
  busyId,
  onEdit,
  onDelete,
}: {
  testimonials: AdminTestimonialRow[];
  isLoading: boolean;
  totalCount: number;
  busyId: string | null;
  onEdit: (row: AdminTestimonialRow) => void;
  onDelete: (id: string) => void;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminTestimonialsComponentsTestimonialsTable");
  if (isLoading && totalCount === 0) {
    return <TableSkeleton rows={6} columns={7} ariaLabel="Loading testimonials" />;
  }

  if (testimonials.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-border bg-white p-10 text-center text-sm text-gray-600 shadow-sm">
        <MessageSquareQuote className="mx-auto mb-2 h-8 w-8 text-brand-text-muted" />
        {i18n("No testimonials yet. Add one to populate the About page.")}</div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-brand-light-bg text-start text-xs uppercase tracking-wider text-brand-black">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">{i18n("Reviewer")}</th>
              <th className="px-4 py-3">{i18n("Rating")}</th>
              <th className="px-4 py-3">{i18n("Testimonial")}</th>
              <th className="px-4 py-3">{i18n("Status")}</th>
              <th className="px-4 py-3">{i18n("Added")}</th>
              <th className="px-4 py-3 text-end">{i18n("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
            {testimonials.map((row) => {
              const isBusy = busyId === row.id;
              return (
                <motion.tr
                  key={row.id}
                  layout
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={LIST_ITEM_VARIANTS}
                  transition={LIST_ITEM_TRANSITION}
                  className="border-t border-brand-border align-top"
                >
                  <td className="px-4 py-3 text-gray-500">{row.position}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          row.image ||
                          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                            row.name,
                          )}`
                        }
                        alt={row.name}
                        className="h-9 w-9 rounded-full object-cover ring-2 ring-brand-border"
                      />
                      <div>
                        <p className="font-semibold text-gray-900">{row.name}</p>
                        {row.location && (
                          <p className="text-xs text-gray-500">{row.location}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Stars rating={row.rating} />
                  </td>
                  <td className="max-w-sm px-4 py-3">
                    <p className="line-clamp-3 text-xs text-gray-600">
                      {row.text}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset",
                        STATUS_BADGE[row.status],
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {formatDate(row.createdAt, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(row)}
                        className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-2.5 py-1 text-xs font-semibold text-brand-black transition hover:bg-brand-light-bg"
                      >
                        <Pencil className="h-3 w-3" />
                        {i18n("Edit")}</button>
                      <button
                        type="button"
                        onClick={() => onDelete(row.id)}
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
