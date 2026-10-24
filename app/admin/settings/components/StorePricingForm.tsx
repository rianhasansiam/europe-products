"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import type React from "react";
import { CircleDollarSign, Percent, RotateCcw, Truck } from "lucide-react";

import type { SettingsFormState } from "@/features/admin-settings/api";
import { ButtonLoader, LoadingSpinner, SectionLoader } from "@/components/ui/loading";

import Field from "@/app/admin/components/Field";

export default function StorePricingForm({
  form,
  setForm,
  hasSettings,
  isLoading,
  isSaving,
  settingsError,
  settingsNote,
  onRefresh,
  onSubmit,
}: {
  form: SettingsFormState;
  setForm: React.Dispatch<React.SetStateAction<SettingsFormState>>;
  hasSettings: boolean;
  isLoading: boolean;
  isSaving: boolean;
  settingsError: string | null;
  settingsNote: string | null;
  onRefresh: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const i18n = useInterfaceTranslations("AdminAdminSettingsComponentsStorePricingForm");
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-white p-5 shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
            <CircleDollarSign className="h-4 w-4 text-brand-red" />
            {i18n("Store pricing")}</h2>
          <p className="mt-1 text-xs text-gray-500">
            {i18n("Tax rate, delivery charges, and free shipping threshold. Applied to every cart on the next pricing pass.")}</p>
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

      {settingsError && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {settingsError}
        </div>
      )}
      {settingsNote && (
        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {settingsNote}
        </div>
      )}

      {isLoading && !hasSettings ? (
        <SectionLoader title={i18n("Loading settings")} rows={4} />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field
              label={i18n("Tax rate (%)")}
              hint={i18n("Customer's cart shows this percentage of subtotal.")}
              icon={<Percent className="h-3.5 w-3.5" />}
              required
            >
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.taxRatePercent}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, taxRatePercent: e.target.value }))
                }
                className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                placeholder="5"
              />
            </Field>

            <Field
              label={i18n("Base currency")}
              hint={i18n("USD pricing requires an explicit review before checkout opens.")}
              required
            >
              <input
                type="text"
                value={form.currency}
                readOnly
                aria-readonly="true"
                className="h-10 w-full cursor-not-allowed rounded-xl border border-brand-border bg-brand-light-bg px-3 text-sm font-semibold uppercase text-gray-600 outline-none"
              />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Field
              label={i18n("Delivery inside Dhaka")}
              icon={<Truck className="h-3.5 w-3.5" />}
              required
            >
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.standardShippingFee}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    standardShippingFee: e.target.value,
                  }))
                }
                className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                placeholder="120"
              />
            </Field>

            <Field
              label={i18n("Delivery outside Dhaka")}
              icon={<Truck className="h-3.5 w-3.5" />}
              required
            >
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.expressShippingFee}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    expressShippingFee: e.target.value,
                  }))
                }
                className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                placeholder="250"
              />
            </Field>

            <Field
              label={i18n("Free shipping above")}
              hint={i18n("Subtotal at which delivery is free. Use 0 to disable.")}
              required
            >
              <input
                type="number"
                step="1"
                min="0"
                value={form.freeShippingThreshold}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    freeShippingThreshold: e.target.value,
                  }))
                }
                className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                placeholder="50000"
              />
            </Field>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={isSaving || !hasSettings}
              aria-busy={isSaving}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-red px-4 text-sm font-semibold text-white transition hover:bg-brand-red-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? <ButtonLoader label={i18n("Saving...")} /> : i18n("Save settings")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
