"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Image as ImageIcon, Pencil, Trash2 } from "lucide-react";

import { LoadingSpinner } from "@/components/ui/loading";

export function RowFooter({
  busyId,
  banner,
  onEdit,
  onDelete,
}: {
  busyId: string | null;
  banner: { id: string };
  onEdit: () => void;
  onDelete: () => void;
}) {
  const i18n = useInterfaceTranslations("AdminAdminBannersComponentsRowFooter");
  const isBusy = busyId === banner.id;
  return (
    <div className="flex items-center justify-end gap-2 pt-1">
      <button
        type="button"
        onClick={onEdit}
        disabled={isBusy}
        className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-brand-light-bg disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Pencil className="h-3.5 w-3.5" /> {i18n("Edit")}</button>
      <button
        type="button"
        onClick={onDelete}
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
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-white p-10 text-center text-sm text-gray-600 shadow-sm">
      <ImageIcon className="mx-auto mb-2 h-8 w-8 text-brand-text-muted" />
      {label}
    </div>
  );
}
