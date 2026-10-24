"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Pencil, Receipt, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import {
  formatCurrency,
  formatDateTime,
  type OtherCostRow,
} from "@/features/admin-capital-costs/api";
import { LoadingSpinner, TableSkeleton } from "@/components/ui/loading";
import {
  LIST_ITEM_TRANSITION,
  LIST_ITEM_VARIANTS,
} from "@/lib/motion/list-removal";

export default function OtherCostsTable({
  costs,
  currency,
  busyId,
  isLoading,
  onEdit,
  onDelete,
}: {
  costs: OtherCostRow[];
  currency: string;
  busyId: string | null;
  isLoading: boolean;
  onEdit: (cost: OtherCostRow) => void;
  onDelete: (cost: OtherCostRow) => void;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminCapitalCostsComponentsOtherCostsTable");
  if (isLoading && costs.length === 0) {
    return <TableSkeleton rows={5} columns={4} ariaLabel="Loading cost records" />;
  }

  if (costs.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-border bg-brand-white p-10 text-center text-sm text-gray-600 shadow-sm">
        <Receipt className="mx-auto mb-2 h-8 w-8 text-brand-text-muted" />
        {i18n("No cost records yet. Add your first manual cost to start tracking.")}</div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-brand-light-bg text-start text-xs uppercase tracking-wider text-foreground">
            <tr>
              <th className="px-4 py-3">{i18n("Reason")}</th>
              <th className="px-4 py-3">{i18n("Amount")}</th>
              <th className="px-4 py-3">{i18n("Cost date")}</th>
              <th className="px-4 py-3 text-end">{i18n("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {costs.map((cost) => {
                const isBusy = busyId === cost.id;
                return (
                  <motion.tr
                    key={cost.id}
                    layout
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    variants={LIST_ITEM_VARIANTS}
                    transition={LIST_ITEM_TRANSITION}
                    className="border-t border-brand-border align-top"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-brand-black">
                        {cost.reason}
                      </p>
                      {cost.description && (
                        <p className="mt-1 max-w-md text-xs text-gray-500">
                          {cost.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(cost.amount, cost.currency || currency, locale)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {formatDateTime(cost.costDate, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(cost)}
                          disabled={isBusy || cost.currency !== currency}
                          className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-brand-light-bg disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Pencil className="h-3.5 w-3.5" /> {i18n("Edit")}</button>
                        <button
                          type="button"
                          onClick={() => onDelete(cost)}
                          disabled={isBusy || cost.currency !== currency}
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
