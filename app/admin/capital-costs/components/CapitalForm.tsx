"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import type React from "react";
import { Plus, RotateCcw, Wallet } from "lucide-react";

import type { CapitalFormState } from "@/features/admin-capital-costs/api";
import { ButtonLoader, LoadingSpinner, SectionLoader } from "@/components/ui/loading";
import Field from "@/app/admin/components/Field";

export default function CapitalForm({
  form,
  setForm,
  currency,
  hasCapital,
  isLoading,
  isSaving,
  error,
  note,
  onRefresh,
  onSubmit,
}: {
  form: CapitalFormState;
  setForm: React.Dispatch<React.SetStateAction<CapitalFormState>>;
  currency: string;
  hasCapital: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  note: string | null;
  onRefresh: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const i18n = useInterfaceTranslations("AdminAdminCapitalCostsComponentsCapitalForm");
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-white p-5 shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
            <Wallet className="h-4 w-4 text-brand-red" />
            {i18n("Add business capital")}</h2>
          <p className="mt-1 text-xs text-gray-500">
            {i18n("Each entry is added to your running total capital. Contributions are kept as a history and are never overwritten.")}</p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          aria-busy={isLoading}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-brand-border px-3 text-xs font-semibold text-foreground transition hover:bg-brand-light-bg"
        >
          {isLoading ? (
            <LoadingSpinner decorative size="sm" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
          {isLoading ? i18n("Refreshing...") : i18n("Refresh")}
        </button>
      </header>

      {error && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {i18n(error)}
        </div>
      )}
      {note && (
        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {note}
        </div>
      )}

      {isLoading && !hasCapital ? (
        <SectionLoader title={i18n("Loading capital")} rows={3} />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field
              label={`Amount to add (${currency})`}
              hint={i18n("Must be greater than zero.")}
              required
            >
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, amount: e.target.value }))
                }
                className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                placeholder="100000"
              />
            </Field>

            <Field label={i18n("Note")} hint={i18n("Optional, e.g. funding source.")}>
              <input
                type="text"
                value={form.note}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, note: e.target.value }))
                }
                className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                placeholder={i18n("Initial investment")}
              />
            </Field>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={isSaving}
              aria-busy={isSaving}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-red px-4 text-sm font-semibold text-white transition hover:bg-brand-red-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? (
                <ButtonLoader label={i18n("Adding...")} />
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  {i18n("Add capital")}</>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
