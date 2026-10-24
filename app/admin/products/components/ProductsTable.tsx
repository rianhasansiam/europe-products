"use client";
import { useLocale } from "next-intl";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { BASE_CURRENCY } from "@/lib/currency/config";
import { formatMoney } from "@/lib/currency/format-money";

import { useInterfaceTranslations } from "@/components/i18n/translate";


/* eslint-disable @next/next/no-img-element */

import { Eye, EyeOff, Pencil, Star, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { TableSkeleton } from "@/components/ui/loading";
import {
  categoryLabel,
  FALLBACK_IMAGE,
  type AdminProduct,
} from "@/features/admin-products/api";
import {
  LIST_ITEM_TRANSITION,
  LIST_ITEM_VARIANTS,
} from "@/lib/motion/list-removal";
import { cn } from "@/lib/utils";


function Actions({
  product,
  busy,
  onEdit,
  onToggleHide,
  onDelete,
}: {
  product: AdminProduct;
  busy: boolean;
  onEdit: (product: AdminProduct) => void;
  onToggleHide: (product: AdminProduct) => void;
  onDelete: (product: AdminProduct) => void;
}) {
  const i18n = useInterfaceTranslations("AdminAdminProductsComponentsProductsTable");
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <button type="button" onClick={() => onEdit(product)} disabled={busy} className="inline-flex h-8 items-center gap-1 rounded-lg border border-brand-border px-2.5 text-xs font-semibold text-gray-700 hover:bg-brand-light-bg disabled:opacity-50">
        <Pencil className="h-3.5 w-3.5" /> {i18n("Edit")}</button>
      <button type="button" onClick={() => onToggleHide(product)} disabled={busy} className="inline-flex h-8 items-center gap-1 rounded-lg border border-brand-border px-2.5 text-xs font-semibold text-gray-700 hover:bg-brand-light-bg disabled:opacity-50">
        {product.status === "ACTIVE" ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        {product.status === "ACTIVE" ? i18n("Hide") : i18n("Show")}
      </button>
      <button type="button" onClick={() => onDelete(product)} disabled={busy} className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
        <Trash2 className="h-3.5 w-3.5" /> {i18n("Delete")}</button>
    </div>
  );
}

export default function ProductsTable({
  products,
  isLoading,
  totalCount,
  busyActionProductId,
  onEdit,
  onToggleHide,
  onDelete,
}: {
  products: AdminProduct[];
  isLoading: boolean;
  totalCount: number;
  busyActionProductId: string | null;
  onEdit: (product: AdminProduct) => void;
  onToggleHide: (product: AdminProduct) => void;
  onDelete: (product: AdminProduct) => void;
}) {
  const locale = useLocale();
  const pricing = useCurrency();
  const formatPrice = (value: number, locale: string) => pricing.pricingReady === false ? `Review required: ${value.toLocaleString(locale)}` : formatMoney(value, BASE_CURRENCY, { locale });
  const i18n = useInterfaceTranslations("AdminAdminProductsComponentsProductsTable");
  if (isLoading && totalCount === 0) {
    return <TableSkeleton rows={6} columns={7} ariaLabel="Loading products" />;
  }
  if (products.length === 0) {
    return <div className="rounded-2xl border border-brand-border bg-white p-10 text-center text-sm text-gray-600 shadow-sm">{i18n("No products found for the current filters.")}</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm">
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-brand-light-bg text-start text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3">{i18n("Product")}</th>
              <th className="px-4 py-3">{i18n("Classification")}</th>
              <th className="px-4 py-3">{i18n("Inventory")}</th>
              <th className="px-4 py-3">{i18n("Pricing")}</th>
              <th className="px-4 py-3">{i18n("Reviews")}</th>
              <th className="px-4 py-3">{i18n("Status")}</th>
              <th className="px-4 py-3 text-end">{i18n("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {products.map((product) => (
                <motion.tr
                  key={product.id}
                  layout
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={LIST_ITEM_VARIANTS}
                  transition={LIST_ITEM_TRANSITION}
                  className="border-t border-brand-border align-top"
                >
                  <td className="px-4 py-3">
                    <div className="flex min-w-56 items-start gap-3">
                      <img src={product.image ?? FALLBACK_IMAGE} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-brand-border object-cover" />
                      <div className="min-w-0">
                        <p className="line-clamp-2 font-semibold text-gray-950">{product.name}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-gray-500">{product.productCode}</p>
                        {(product.modelNumber || product.series) && (
                          <p className="mt-1 text-xs text-gray-500">{[product.modelNumber, product.series].filter(Boolean).join(" · ")}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="max-w-64 px-4 py-3">
                    <p className="line-clamp-2 text-xs font-semibold text-gray-800">{categoryLabel(product)}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {[product.brand?.name, product.manufacturer?.name].filter(Boolean).join(" · ") || "No brand or manufacturer"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-gray-950">{product.stock} {i18n("units")}</p>
                    <p className="mt-1 text-xs text-gray-500">{product.variants.length} {product.variants.length === 1 ? i18n("variant") : i18n("variants")}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-gray-950">{formatPrice(product.discountPrice ?? product.salePrice, locale)}</p>
                    {product.discountPrice !== null && <p className="text-xs text-gray-400 line-through">{formatPrice(product.salePrice, locale)}</p>}
                    <p className="mt-1 text-[11px] text-gray-500">{i18n("Cost")}{" "}{formatPrice(product.buyingPrice, locale)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 font-semibold text-gray-800"><Star className="h-3.5 w-3.5 fill-brand-gold text-brand-gold" /> {product.rating.toFixed(1)}</span>
                    <p className="mt-1 text-xs text-gray-500">{product.reviewCount} {i18n("reviews")}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-1 text-xs font-semibold", product.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{product.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Actions product={product} busy={busyActionProductId === product.id} onEdit={onEdit} onToggleHide={onToggleHide} onDelete={onDelete} />
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-brand-border md:hidden">
        {products.map((product) => (
          <article key={product.id} className="p-4">
            <div className="flex gap-3">
              <img src={product.image ?? FALLBACK_IMAGE} alt="" className="h-16 w-16 shrink-0 rounded-xl border border-brand-border object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="line-clamp-2 font-bold text-gray-950">{product.name}</h3>
                    <p className="mt-0.5 font-mono text-[11px] text-gray-500">{product.productCode}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-1 text-[10px] font-bold", product.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{product.status}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-gray-600">{categoryLabel(product)}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-brand-light-bg p-3 text-xs">
              <div><p className="text-gray-500">{i18n("Price")}</p><p className="mt-0.5 font-bold">{formatPrice(product.discountPrice ?? product.salePrice, locale)}</p></div>
              <div><p className="text-gray-500">{i18n("Stock")}</p><p className="mt-0.5 font-bold">{product.stock}</p></div>
              <div><p className="text-gray-500">{i18n("Variants")}</p><p className="mt-0.5 font-bold">{product.variants.length}</p></div>
            </div>
            <div className="mt-3"><Actions product={product} busy={busyActionProductId === product.id} onEdit={onEdit} onToggleHide={onToggleHide} onDelete={onDelete} /></div>
          </article>
        ))}
      </div>
    </div>
  );
}
