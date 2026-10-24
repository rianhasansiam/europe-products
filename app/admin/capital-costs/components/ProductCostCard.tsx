"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Boxes, Info, Plus, Trash2 } from "lucide-react";

import type {
  ProductCostItem,
  ProductCostSummary,
} from "@/features/admin-capital-costs/api";
import { formatCurrency } from "@/features/admin-capital-costs/api";
import { ButtonLoader, SectionLoader } from "@/components/ui/loading";

export default function ProductCostCard({
  productCost,
  currency,
  isLoading,
  busyId,
  onAdd,
  onRemove,
}: {
  productCost: ProductCostSummary | null;
  currency: string;
  isLoading: boolean;
  busyId: string | null;
  onAdd: () => void;
  onRemove: (item: ProductCostItem) => void;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminCapitalCostsComponentsProductCostCard");
  const items = productCost?.items ?? [];

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-white p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
            <Boxes className="h-4 w-4 text-brand-red" />
            {i18n("Product costs")}</h2>
          <p className="mt-1 text-xs text-gray-500">
            {i18n("Only products you select here are included in your costs.")}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-brand-red px-3 text-xs font-semibold text-white transition hover:bg-brand-red-hover"
        >
          <Plus className="h-3.5 w-3.5" />
          {i18n("Add products")}</button>
      </header>

      {isLoading && !productCost ? (
        <SectionLoader title={i18n("Loading selected product costs")} rows={3} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric
              label={i18n("Total product cost")}
              value={formatCurrency(productCost?.totalProductCost ?? 0, currency, locale)}
            />
            <Metric
              label={i18n("Selected products")}
              value={(productCost?.productCount ?? 0).toLocaleString(locale)}
            />
            <Metric
              label={i18n("Stock units")}
              value={(productCost?.totalUnits ?? 0).toLocaleString(locale)}
            />
          </div>

          {items.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-brand-border bg-brand-light-bg p-5 text-center">
              <Boxes className="mx-auto h-6 w-6 text-brand-text-muted" />
              <p className="mt-2 text-sm font-semibold text-gray-700">
                {i18n("No product costs selected")}</p>
              <p className="mt-1 text-xs text-gray-500">
                {i18n("Add only the catalog products you want to count as a cost.")}</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {items.map((item) => {
                const isBusy = busyId === item.id;
                return (
                  <article
                    key={item.id}
                    className="rounded-xl border border-brand-border bg-brand-light-bg p-3"
                  >
                    <div className="flex gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-bold text-brand-black">
                            {item.productName}
                          </h3>
                          {item.status === "INACTIVE" && (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                              {i18n("Inactive")}</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          {item.productCode}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(item)}
                        disabled={isBusy}
                        aria-label={`Remove ${item.productName} from product costs`}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isBusy ? <ButtonLoader /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <Detail label={i18n("Buying")} value={formatCurrency(item.buyingPrice, currency, locale)} />
                      <Detail label={i18n("Stock")} value={item.totalUnits.toLocaleString(locale)} />
                      <Detail label={i18n("Cost")} value={formatCurrency(item.totalCost, currency, locale)} strong />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      <p className="mt-4 flex items-start gap-2 rounded-xl bg-brand-light-bg p-3 text-[11px] text-gray-600">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-red" />
        {i18n("Each selected card uses the product's current buying price and on-hand stock. Removing a card stops that product from affecting the cost total.")}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-light-bg p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-extrabold text-brand-black">{value}</p>
    </div>
  );
}

function Detail({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className={strong ? "mt-0.5 font-bold text-brand-black" : "mt-0.5 text-gray-700"}>
        {value}
      </p>
    </div>
  );
}
