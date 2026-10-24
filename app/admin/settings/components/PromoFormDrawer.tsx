"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import {
  DISCOUNT_TYPE_VALUES,
  PROMO_STATUS_VALUES,
  type PromoCodeStatus,
  type PromoDiscountType,
  type PromoFormState,
} from "@/features/admin-settings/api";
import { ButtonLoader } from "@/components/ui/loading";
import { cn } from "@/lib/utils";

import Field from "@/app/admin/components/Field";

export default function PromoFormDrawer({
  open,
  mode,
  form,
  setForm,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  form: PromoFormState;
  setForm: React.Dispatch<React.SetStateAction<PromoFormState>>;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const i18n = useInterfaceTranslations("AdminAdminSettingsComponentsPromoFormDrawer");
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
              {mode === "create" ? i18n("Create promo code") : i18n("Edit promo code")}
            </h2>
            <p className="mt-0.5 text-xs text-white/70">
              {i18n("Customers apply these at checkout. Case-insensitive on the wire.")}</p>
          </div>

          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={i18n("Code")} required>
                  <input
                    value={form.code}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, code: e.target.value }))
                    }
                    className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm font-mono uppercase outline-none transition focus:border-brand-red"
                    placeholder="SEXTOY10"
                  />
                </Field>
                <Field label={i18n("Status")} required>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        status: e.target.value as PromoCodeStatus,
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                  >
                    {PROMO_STATUS_VALUES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label={i18n("Description")}>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="min-h-20 w-full rounded-xl border border-brand-border px-3 py-2 text-sm outline-none transition focus:border-brand-red"
                  placeholder={i18n("What this code does, shown internally.")}
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={i18n("Discount type")} required>
                  <select
                    value={form.discountType}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        discountType: e.target.value as PromoDiscountType,
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                  >
                    {DISCOUNT_TYPE_VALUES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={
                    form.discountType === "PERCENT"
                      ? i18n("Value (%)")
                      : i18n("Value (currency)")
                  }
                  required
                >
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.value}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, value: e.target.value }))
                    }
                    className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                    placeholder={form.discountType === "PERCENT" ? "10" : "500"}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={i18n("Minimum order")}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.minOrder}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, minOrder: e.target.value }))
                    }
                    className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                    placeholder={i18n("Optional")}
                  />
                </Field>
                <Field
                  label={i18n("Max discount")}
                  hint={
                    form.discountType === "PERCENT"
                      ? i18n("Cap on percentage discount.")
                      : undefined
                  }
                >
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.maxDiscount}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        maxDiscount: e.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                    placeholder={i18n("Optional")}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={i18n("Starts at")}>
                  <input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, startsAt: e.target.value }))
                    }
                    className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                  />
                </Field>
                <Field label={i18n("Ends at")}>
                  <input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, endsAt: e.target.value }))
                    }
                    className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                  />
                </Field>
              </div>

              <Field
                label={i18n("Usage limit")}
                hint={i18n("Total redemptions allowed across all customers.")}
              >
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={form.usageLimit}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, usageLimit: e.target.value }))
                  }
                  className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                  placeholder={i18n("Optional")}
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
                    <ButtonLoader label={mode === "create" ? i18n("Creating...") : i18n("Saving...")} />
                  ) : mode === "create" ? (
                    i18n("Create")
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
