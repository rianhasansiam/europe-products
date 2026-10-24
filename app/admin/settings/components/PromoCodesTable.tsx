"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Pencil, Ticket, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import {
  formatCurrency,
  formatDate,
  type PromoCodeRow,
  type PromoCodeStatus,
  type PromoDiscountType,
} from "@/features/admin-settings/api";
import { LoadingSpinner } from "@/components/ui/loading";
import {
  LIST_ITEM_TRANSITION,
  LIST_ITEM_VARIANTS,
} from "@/lib/motion/list-removal";
import { cn } from "@/lib/utils";

const STATUS_BADGE: Record<PromoCodeStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  INACTIVE: "bg-amber-50 text-amber-700 ring-amber-200",
};

const TYPE_BADGE: Record<PromoDiscountType, string> = {
  FLAT: "bg-brand-light-bg text-brand-black ring-brand-border",
  PERCENT: "bg-brand-red/10 text-brand-red ring-brand-red/30",
};

export default function PromoCodesTable({
  promos,
  currency,
  busyPromoId,
  onEdit,
  onDelete,
}: {
  promos: PromoCodeRow[];
  currency: string;
  busyPromoId: string | null;
  onEdit: (promo: PromoCodeRow) => void;
  onDelete: (promo: PromoCodeRow) => void;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminSettingsComponentsPromoCodesTable");
  if (promos.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-border bg-brand-white p-10 text-center text-sm text-gray-600 shadow-sm">
        <Ticket className="mx-auto mb-2 h-8 w-8 text-brand-text-muted" />
        {i18n("No promo codes yet. Create your first to start running campaigns.")}</div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-brand-light-bg text-start text-xs uppercase tracking-wider text-foreground">
            <tr>
              <th className="px-4 py-3">{i18n("Code")}</th>
              <th className="px-4 py-3">{i18n("Discount")}</th>
              <th className="px-4 py-3">{i18n("Conditions")}</th>
              <th className="px-4 py-3">{i18n("Active window")}</th>
              <th className="px-4 py-3">{i18n("Usage")}</th>
              <th className="px-4 py-3">{i18n("Status")}</th>
              <th className="px-4 py-3 text-end">{i18n("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
            {promos.map((promo) => {
              const isBusy = busyPromoId === promo.id;
              const valueLabel =
                promo.discountType === "PERCENT"
                  ? `${promo.value}%`
                  : formatCurrency(promo.value, currency, locale);

              return (
                <motion.tr
                  key={promo.id}
                  layout
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={LIST_ITEM_VARIANTS}
                  transition={LIST_ITEM_TRANSITION}
                  className="border-t border-brand-border align-top"
                >
                  <td className="px-4 py-3">
                    <p className="font-mono text-sm font-bold uppercase text-brand-black">
                      {promo.code}
                    </p>
                    {promo.description && (
                      <p className="mt-1 text-xs text-gray-500">
                        {promo.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset",
                        TYPE_BADGE[promo.discountType],
                      )}
                    >
                      {promo.discountType}
                    </span>
                    <p className="mt-1 font-semibold text-gray-900">
                      {valueLabel}
                    </p>
                    {promo.maxDiscount != null &&
                      promo.discountType === "PERCENT" && (
                        <p className="text-xs text-gray-500">
                          {i18n("Max")}{" "}{formatCurrency(promo.maxDiscount, currency, locale)}
                        </p>
                      )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {promo.minOrder != null ? (
                      <p>
                        {i18n("Min order:")}{" "}
                        <span className="font-semibold text-gray-800">
                          {formatCurrency(promo.minOrder, currency, locale)}
                        </span>
                      </p>
                    ) : (
                      <p>{i18n("No minimum")}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    <p>{i18n("From:")}{" "}{formatDate(promo.startsAt, locale)}</p>
                    <p>{i18n("To:")}{" "}{formatDate(promo.endsAt, locale)}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    <p className="font-semibold text-gray-900">
                      {promo.usedCount}
                      {promo.usageLimit != null && (
                        <span className="font-normal text-gray-500">
                          {" "}
                          / {promo.usageLimit}
                        </span>
                      )}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset",
                        STATUS_BADGE[promo.status],
                      )}
                    >
                      {promo.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(promo)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-brand-light-bg disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Pencil className="h-3.5 w-3.5" /> {i18n("Edit")}</button>
                      <button
                        type="button"
                        onClick={() => onDelete(promo)}
                        disabled={isBusy}
                        aria-busy={isBusy}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isBusy ? (
                          <LoadingSpinner decorative size="sm" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
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
