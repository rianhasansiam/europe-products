"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


/* eslint-disable @next/next/no-img-element */

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FolderPlus,
  FolderTree,
  Pencil,
  Trash2,
} from "lucide-react";

import { formatDate, type AdminCategoryRow } from "@/features/admin-categories/api";
import { LoadingSpinner, TableSkeleton } from "@/components/ui/loading";
import { cn } from "@/lib/utils";

export type CategoryTreeTableRow = {
  category: AdminCategoryRow;
  hasChildren: boolean;
  isExpanded: boolean;
};

type Props = {
  rows: CategoryTreeTableRow[];
  isLoading: boolean;
  totalCount: number;
  busyId: string | null;
  onToggleExpanded: (id: string) => void;
  onAddChild: (category: AdminCategoryRow) => void;
  onEdit: (category: AdminCategoryRow) => void;
  onMoveUp: (category: AdminCategoryRow) => void;
  onMoveDown: (category: AdminCategoryRow) => void;
  onToggleVisibility: (category: AdminCategoryRow) => void;
  onDelete: (category: AdminCategoryRow) => void;
};

export default function CategoriesTable(props: Props) {
  const i18n = useInterfaceTranslations("AdminAdminCategoriesComponentsCategoriesTable");
  if (props.isLoading && props.totalCount === 0) {
    return <TableSkeleton rows={7} columns={6} ariaLabel="Loading category tree" />;
  }
  if (props.rows.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-border bg-brand-white p-10 text-center text-sm text-gray-600 shadow-sm">
        <FolderTree className="mx-auto mb-2 h-8 w-8 text-brand-text-muted" />
        {i18n("No categories match the current filters.")}</div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-white shadow-sm">
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-brand-light-bg text-start text-xs uppercase tracking-wider text-brand-text-muted">
            <tr>
              <th className="px-4 py-3">{i18n("Category tree")}</th>
              <th className="px-4 py-3">{i18n("Path")}</th>
              <th className="px-4 py-3">{i18n("Status")}</th>
              <th className="px-4 py-3 text-center">{i18n("Products")}</th>
              <th className="px-4 py-3 text-center">{i18n("Order")}</th>
              <th className="px-4 py-3 text-end">{i18n("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row) => (
              <DesktopRow key={row.category.id} row={row} {...props} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-brand-border md:hidden">
        {props.rows.map((row) => (
          <MobileRow key={row.category.id} row={row} {...props} />
        ))}
      </div>
    </div>
  );
}

function DesktopRow({ row, ...props }: Props & { row: CategoryTreeTableRow }) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminCategoriesComponentsCategoriesTable");
  const { category, hasChildren } = row;
  const busy = props.busyId === category.id;
  return (
    <tr className="border-t border-brand-border align-middle hover:bg-brand-light-bg/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2" style={{ paddingInlineStart: `${category.depth * 22}px` }}>
          <ExpandButton row={row} onToggle={props.onToggleExpanded} />
          <CategoryAvatar category={category} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900">{category.name}</p>
            <p className="text-[11px] text-gray-500">
              {category.parentId ? i18n("Level {level}", { level: category.depth + 1 }) : i18n("Root category")}
              {hasChildren ? i18n(" · {count, plural, one {# child} other {# children}}", { count: category.childCount }) : ""}
            </p>
          </div>
        </div>
      </td>
      <td className="max-w-64 px-4 py-3">
        <code className="block truncate rounded bg-gray-50 px-2 py-1 text-[11px] text-gray-700">/{category.path}</code>
        <span className="mt-1 block text-[10px] text-gray-400">{i18n("Updated")}{" "}{formatDate(category.updatedAt, locale)}</span>
      </td>
      <td className="px-4 py-3"><StatusBadge category={category} /></td>
      <td className="px-4 py-3 text-center">
        <p className="font-semibold text-gray-900">{category.totalProductCount}</p>
        <p className="text-[10px] text-gray-500">{category.directProductCount} {i18n("direct")}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-center gap-1">
          <IconButton label={i18n("Move up")} disabled={busy} onClick={() => props.onMoveUp(category)}><ArrowUp /></IconButton>
          <span className="min-w-6 text-center text-xs font-semibold text-gray-600">{category.position + 1}</span>
          <IconButton label={i18n("Move down")} disabled={busy} onClick={() => props.onMoveDown(category)}><ArrowDown /></IconButton>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <IconButton label={i18n("Add subcategory")} disabled={busy} onClick={() => props.onAddChild(category)}><FolderPlus /></IconButton>
          <IconButton label={i18n("Edit category")} disabled={busy} onClick={() => props.onEdit(category)}><Pencil /></IconButton>
          <IconButton
            label={category.status === "ACTIVE" ? i18n("Hide category") : i18n("Show category")}
            disabled={busy}
            tone="warning"
            onClick={() => props.onToggleVisibility(category)}
          >
            {category.status === "ACTIVE" ? <EyeOff /> : <Eye />}
          </IconButton>
          <IconButton
            label={deletionLabel(category)}
            disabled={busy || category.childCount > 0 || category.directProductCount > 0}
            tone="danger"
            onClick={() => props.onDelete(category)}
          >
            {busy ? <LoadingSpinner decorative size="sm" /> : <Trash2 />}
          </IconButton>
        </div>
      </td>
    </tr>
  );
}

function MobileRow({ row, ...props }: Props & { row: CategoryTreeTableRow }) {
  const i18n = useInterfaceTranslations("AdminAdminCategoriesComponentsCategoriesTable");
  const { category } = row;
  const busy = props.busyId === category.id;
  return (
    <article className="p-4" style={{ paddingInlineStart: `${16 + Math.min(category.depth, 4) * 12}px` }}>
      <div className="flex items-start gap-2">
        <ExpandButton row={row} onToggle={props.onToggleExpanded} />
        <CategoryAvatar category={category} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-gray-900">{category.name}</h3>
            <StatusBadge category={category} />
          </div>
          <p className="mt-0.5 truncate font-mono text-[11px] text-gray-500">/{category.path}</p>
          <p className="mt-1 text-xs text-gray-600">
            {category.totalProductCount} {i18n("subtree products ·")}{" "}{category.directProductCount} {i18n("direct · position")}{" "}{category.position + 1}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 ps-8">
        <ActionButton onClick={() => props.onAddChild(category)} disabled={busy}><FolderPlus /> {i18n("Add child")}</ActionButton>
        <ActionButton onClick={() => props.onEdit(category)} disabled={busy}><Pencil /> {i18n("Edit")}</ActionButton>
        <ActionButton onClick={() => props.onMoveUp(category)} disabled={busy}><ArrowUp /> {i18n("Up")}</ActionButton>
        <ActionButton onClick={() => props.onMoveDown(category)} disabled={busy}><ArrowDown /> {i18n("Down")}</ActionButton>
        <ActionButton onClick={() => props.onToggleVisibility(category)} disabled={busy} tone="warning">
          {category.status === "ACTIVE" ? <EyeOff /> : <Eye />} {category.status === "ACTIVE" ? i18n("Hide") : i18n("Show")}
        </ActionButton>
        <ActionButton
          onClick={() => props.onDelete(category)}
          disabled={busy || category.childCount > 0 || category.directProductCount > 0}
          tone="danger"
          title={deletionLabel(category)}
        ><Trash2 /> {i18n("Delete")}</ActionButton>
      </div>
    </article>
  );
}

function ExpandButton({ row, onToggle }: { row: CategoryTreeTableRow; onToggle: (id: string) => void }) {
  const i18n = useInterfaceTranslations("AdminAdminCategoriesComponentsCategoriesTable");
  if (!row.hasChildren) return <span className="h-7 w-7 shrink-0" aria-hidden />;
  return (
    <button
      type="button"
      aria-label={`${row.isExpanded ? i18n("Collapse") : i18n("Expand")} ${row.category.name}`}
      aria-expanded={row.isExpanded}
      onClick={() => onToggle(row.category.id)}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-white hover:text-brand-red"
    >
      {row.isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </button>
  );
}

function CategoryAvatar({ category }: { category: AdminCategoryRow }) {
  return category.image ? (
    <img src={category.image} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-brand-border object-cover" />
  ) : (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-black text-xs font-bold text-white">
      {category.name.slice(0, 2).toUpperCase() || "?"}
    </span>
  );
}

function StatusBadge({ category }: { category: AdminCategoryRow }) {
  const hiddenByAncestor =
    category.status === "ACTIVE" && !category.effectiveActive;
  const label = hiddenByAncestor ? "HIDDEN BY PARENT" : category.status;

  return (
    <span className={cn(
      "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 ring-inset",
      hiddenByAncestor
        ? "bg-slate-100 text-slate-700 ring-slate-300"
        : category.status === "ACTIVE"
        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
        : "bg-amber-50 text-amber-700 ring-amber-200",
    )}>{label}</span>
  );
}

function IconButton({ label, children, tone = "default", ...props }: {
  label: string;
  children: React.ReactNode;
  tone?: "default" | "warning" | "danger";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-35 [&_svg]:h-3.5 [&_svg]:w-3.5",
        tone === "danger" && "border-red-200 text-red-700 hover:bg-red-50",
        tone === "warning" && "border-amber-200 text-amber-700 hover:bg-amber-50",
        tone === "default" && "border-brand-border text-brand-black hover:bg-brand-light-bg",
      )}
    >{children}</button>
  );
}

function ActionButton({ children, tone = "default", ...props }: {
  children: React.ReactNode;
  tone?: "default" | "warning" | "danger";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 [&_svg]:h-3.5 [&_svg]:w-3.5",
        tone === "danger" && "border-red-200 text-red-700 hover:bg-red-50",
        tone === "warning" && "border-amber-200 text-amber-700 hover:bg-amber-50",
        tone === "default" && "border-brand-border text-brand-black hover:bg-brand-light-bg",
      )}
    >{children}</button>
  );
}

function deletionLabel(category: AdminCategoryRow): string {
  if (category.childCount > 0) return "Move or remove child categories before deleting";
  if (category.directProductCount > 0) return "Move products before deleting";
  return "Delete category";
}
