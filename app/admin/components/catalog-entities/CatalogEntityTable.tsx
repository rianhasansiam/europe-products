"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


/* eslint-disable @next/next/no-img-element */

import {
  ExternalLink,
  Eye,
  EyeOff,
  Factory,
  Pencil,
  Tags,
  Trash2,
} from "lucide-react";

import { LoadingSpinner, TableSkeleton } from "@/components/ui/loading";
import {
  formatCatalogEntityDate,
  type AdminCatalogEntityRow,
  type CatalogEntityKind,
} from "@/features/admin-catalog-entities/api";
import { cn } from "@/lib/utils";

function Logo({ row }: { row: AdminCatalogEntityRow }) {
  return row.logo ? (
    <img
      src={row.logo}
      alt=""
      className="h-11 w-11 shrink-0 rounded-xl border border-brand-border bg-white object-contain p-1"
    />
  ) : (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-black text-xs font-black text-white">
      {row.name.slice(0, 2).toUpperCase() || "?"}
    </span>
  );
}

function StatusBadge({ row }: { row: AdminCatalogEntityRow }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset",
        row.status === "ACTIVE"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-gray-100 text-gray-600 ring-gray-200",
      )}
    >
      {row.status}
    </span>
  );
}

function RowActions({
  row,
  busy,
  onEdit,
  onToggle,
  onDelete,
}: {
  row: AdminCatalogEntityRow;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const i18n = useInterfaceTranslations("AdminAdminComponentsCatalogEntitiesCatalogEntityTable");
  const deleteBlocked = row.productCount > 0;
  return (
    <div className="flex flex-wrap items-center gap-2 md:justify-end">
      <button
        type="button"
        onClick={onEdit}
        disabled={busy}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-brand-border px-2.5 text-xs font-semibold text-brand-black transition hover:bg-brand-light-bg disabled:opacity-50"
      >
        <Pencil className="h-3.5 w-3.5" /> {i18n("Edit")}</button>
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-200 px-2.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
      >
        {busy ? (
          <LoadingSpinner decorative size="xs" />
        ) : row.status === "ACTIVE" ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
        {row.status === "ACTIVE" ? i18n("Hide") : i18n("Show")}
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy || deleteBlocked}
        title={
          deleteBlocked
            ? i18n("Reassign {count, plural, one {# linked product} other {# linked products}} before deleting.", { count: row.productCount })
            : undefined
        }
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 px-2.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 className="h-3.5 w-3.5" /> {i18n("Delete")}</button>
    </div>
  );
}

export default function CatalogEntityTable({
  kind,
  rows,
  isLoading,
  totalCount,
  busyId,
  onEdit,
  onToggle,
  onDelete,
}: {
  kind: CatalogEntityKind;
  rows: AdminCatalogEntityRow[];
  isLoading: boolean;
  totalCount: number;
  busyId: string | null;
  onEdit: (row: AdminCatalogEntityRow) => void;
  onToggle: (row: AdminCatalogEntityRow) => void;
  onDelete: (row: AdminCatalogEntityRow) => void;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminComponentsCatalogEntitiesCatalogEntityTable");
  const pluralLabel = kind === "brand" ? "brands" : "manufacturers";
  const EmptyIcon = kind === "brand" ? Tags : Factory;

  if (isLoading && totalCount === 0) {
    return <TableSkeleton rows={6} columns={6} ariaLabel={`Loading ${pluralLabel}`} />;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-border bg-white p-10 text-center text-sm text-gray-600 shadow-sm">
        <EmptyIcon className="mx-auto mb-2 h-9 w-9 text-brand-text-muted" />
        {i18n("No")}{" "}{pluralLabel} {i18n("match the current filters.")}</div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm">
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-brand-light-bg text-start text-xs uppercase tracking-wider text-brand-text-muted">
            <tr>
              <th className="px-4 py-3">{kind === "brand" ? i18n("Brand") : i18n("Manufacturer")}</th>
              <th className="px-4 py-3">{i18n("Details")}</th>
              <th className="px-4 py-3">{i18n("Status")}</th>
              <th className="px-4 py-3">{i18n("Products")}</th>
              <th className="px-4 py-3">{i18n("Created")}</th>
              <th className="px-4 py-3 text-end">{i18n("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-brand-border align-top">
                <td className="px-4 py-3">
                  <div className="flex min-w-52 items-start gap-3">
                    <Logo row={row} />
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{row.name}</p>
                      <p className="mt-0.5 break-all font-mono text-[11px] text-gray-500">
                        {row.slug}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="max-w-64 px-4 py-3 text-xs text-gray-600">
                  {kind === "manufacturer" && row.country && (
                    <p className="font-semibold text-gray-800">{row.country}</p>
                  )}
                  {row.website && (
                    <a
                      href={row.website}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-flex max-w-56 items-center gap-1 truncate text-brand-red hover:underline"
                    >
                      <span className="truncate">{row.website}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  )}
                  {!row.country && !row.website && <span>—</span>}
                </td>
                <td className="px-4 py-3"><StatusBadge row={row} /></td>
                <td className="px-4 py-3 font-semibold text-gray-700">
                  {row.productCount.toLocaleString(locale)}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {formatCatalogEntityDate(row.createdAt, locale)}
                </td>
                <td className="px-4 py-3">
                  <RowActions
                    row={row}
                    busy={busyId === row.id}
                    onEdit={() => onEdit(row)}
                    onToggle={() => onToggle(row)}
                    onDelete={() => onDelete(row)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-brand-border md:hidden">
        {rows.map((row) => (
          <article key={row.id} className="space-y-3 p-4">
            <div className="flex items-start gap-3">
              <Logo row={row} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-gray-900">
                      {row.name}
                    </h2>
                    <p className="truncate font-mono text-[11px] text-gray-500">
                      {row.slug}
                    </p>
                  </div>
                  <StatusBadge row={row} />
                </div>
                {kind === "manufacturer" && row.country && (
                  <p className="mt-1 text-xs text-gray-600">{row.country}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-xl bg-brand-light-bg p-3 text-xs">
              <div>
                <p className="text-gray-500">{i18n("Products")}</p>
                <p className="font-bold text-gray-900">{row.productCount}</p>
              </div>
              <div>
                <p className="text-gray-500">{i18n("Created")}</p>
                <p className="font-semibold text-gray-900">
                  {formatCatalogEntityDate(row.createdAt, locale)}
                </p>
              </div>
            </div>

            <RowActions
              row={row}
              busy={busyId === row.id}
              onEdit={() => onEdit(row)}
              onToggle={() => onToggle(row)}
              onDelete={() => onDelete(row)}
            />
          </article>
        ))}
      </div>
    </div>
  );
}
