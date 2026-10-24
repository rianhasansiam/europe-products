"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { X } from "lucide-react";

import {
  STATUS_VALUES,
  type TestimonialFormState,
  type TestimonialStatus,
} from "@/features/admin-testimonials/api";
import ImageUploader from "@/components/ui/ImageUploader";
import { ButtonLoader } from "@/components/ui/loading";

export default function TestimonialForm({
  mode,
  form,
  setForm,
  saving,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  form: TestimonialFormState;
  setForm: React.Dispatch<React.SetStateAction<TestimonialFormState>>;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const i18n = useInterfaceTranslations("AdminAdminTestimonialsComponentsTestimonialForm");
  const update = <K extends keyof TestimonialFormState>(
    key: K,
    value: TestimonialFormState[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-brand-border bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900">
          {mode === "create" ? i18n("Add testimonial") : i18n("Edit testimonial")}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100"
          aria-label={i18n("Close form")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ImageUploader
            category="users"
            label={i18n("Avatar (optional)")}
            value={form.image}
            onChange={(url) => update("image", url)}
            disabled={saving}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
            {i18n("Name")}<input
              type="text"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder={i18n("e.g. Sneha Iyer")}
              className="h-10 rounded-xl border border-brand-border px-3 text-sm font-normal text-gray-900 outline-none transition focus:border-brand-red"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
            {i18n("Location (optional)")}<input
              type="text"
              value={form.location}
              onChange={(event) => update("location", event.target.value)}
              placeholder={i18n("e.g. Dhaka")}
              className="h-10 rounded-xl border border-brand-border px-3 text-sm font-normal text-gray-900 outline-none transition focus:border-brand-red"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
            {i18n("Rating")}<select
              value={String(form.rating)}
              onChange={(event) => update("rating", Number(event.target.value))}
              className="h-10 rounded-xl border border-brand-border px-3 text-sm font-normal text-gray-900 outline-none transition focus:border-brand-red"
            >
              {[5, 4, 3, 2, 1].map((star) => (
                <option key={star} value={star}>
                  {i18n("{count, plural, one {# star} other {# stars}}", { count: star })}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
            {i18n("Display order")}<input
              type="number"
              min={0}
              value={form.position}
              onChange={(event) =>
                update("position", Number(event.target.value) || 0)
              }
              className="h-10 rounded-xl border border-brand-border px-3 text-sm font-normal text-gray-900 outline-none transition focus:border-brand-red"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700 sm:col-span-2">
            {i18n("Testimonial")}<textarea
              value={form.text}
              onChange={(event) => update("text", event.target.value)}
              placeholder={i18n("What did the shopper say?")}
              rows={3}
              className="rounded-xl border border-brand-border px-3 py-2 text-sm font-normal text-gray-900 outline-none transition focus:border-brand-red"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
            {i18n("Status")}<select
              value={form.status}
              onChange={(event) =>
                update("status", event.target.value as TestimonialStatus)
              }
              className="h-10 rounded-xl border border-brand-border px-3 text-sm font-normal text-gray-900 outline-none transition focus:border-brand-red"
            >
              {STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-10 items-center rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          {i18n("Cancel")}</button>
        <button
          type="submit"
          disabled={saving}
          aria-busy={saving}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-red px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-red-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <ButtonLoader label={mode === "create" ? i18n("Adding...") : i18n("Saving...")} />
          ) : mode === "create" ? (
            i18n("Add testimonial")
          ) : (
            i18n("Save changes")
          )}
        </button>
      </div>
    </form>
  );
}
