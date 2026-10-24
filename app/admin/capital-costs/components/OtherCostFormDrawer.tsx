"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import type React from "react";

import type { OtherCostFormState } from "@/features/admin-capital-costs/api";
import { ButtonLoader } from "@/components/ui/loading";
import { cn } from "@/lib/utils";

import Field from "@/app/admin/components/Field";

export default function OtherCostFormDrawer({
  open,
  mode,
  form,
  setForm,
  currency,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  form: OtherCostFormState;
  setForm: React.Dispatch<React.SetStateAction<OtherCostFormState>>;
  currency: string;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const i18n = useInterfaceTranslations("AdminAdminCapitalCostsComponentsOtherCostFormDrawer");
  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-60 bg-gray-900/35 backdrop-blur-[1px] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-70 w-full max-w-md border-s border-brand-border bg-brand-white shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-brand-border bg-brand-black px-5 py-4 text-white">
            <h2 className="text-lg font-bold">
              {mode === "create" ? i18n("Add other cost") : i18n("Edit other cost")}
            </h2>
            <p className="mt-0.5 text-xs text-white/70">
              {i18n("Manual costs like rent, salaries, ads, and utilities.")}</p>
          </div>

          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {i18n(error)}
                </div>
              )}

              <Field label={i18n("Reason / title")} required>
                <input
                  value={form.reason}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                  placeholder={i18n("Office rent")}
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={`Amount (${currency})`} required>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, amount: e.target.value }))
                    }
                    className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                    placeholder="5000"
                  />
                </Field>
                <Field label={i18n("Cost date & time")} required>
                  <input
                    type="datetime-local"
                    value={form.costDate}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, costDate: e.target.value }))
                    }
                    className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                  />
                </Field>
              </div>

              <Field label={i18n("Description / note")}>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="min-h-24 w-full rounded-xl border border-brand-border px-3 py-2 text-sm outline-none transition focus:border-brand-red"
                  placeholder={i18n("Optional details about this cost.")}
                />
              </Field>
            </div>

            <div className="border-t border-brand-border bg-brand-white px-5 py-4">
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 rounded-xl border border-brand-border px-4 text-sm font-semibold text-foreground transition hover:bg-brand-light-bg"
                >
                  {i18n("Cancel")}</button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-red px-4 text-sm font-semibold text-white transition hover:bg-brand-red-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <ButtonLoader label={mode === "create" ? i18n("Adding...") : i18n("Saving...")} />
                  ) : mode === "create" ? (
                    i18n("Add cost")
                  ) : (
                    i18n("Save changes")
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </aside>
    </>
  );
}
