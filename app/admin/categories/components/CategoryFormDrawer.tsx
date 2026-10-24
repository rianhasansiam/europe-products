"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";

import {
  STATUS_VALUES,
  categoryLabel,
  type AdminCategoryRow,
  type CategoryFormState,
  type CategoryStatus,
} from "@/features/admin-categories/api";
import ImageUploader from "@/components/ui/ImageUploader";
import { ButtonLoader } from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import Field from "@/app/admin/components/Field";

export default function CategoryFormDrawer({
  open,
  mode,
  editing,
  categories,
  invalidParentIds,
  form,
  isSubmitting,
  onClose,
  onChange,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  editing: AdminCategoryRow | null;
  categories: AdminCategoryRow[];
  invalidParentIds: Set<string>;
  form: CategoryFormState;
  isSubmitting: boolean;
  onClose: () => void;
  onChange: React.Dispatch<React.SetStateAction<CategoryFormState>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const i18n = useInterfaceTranslations("AdminAdminCategoriesComponentsCategoryFormDrawer");
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => nameRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [isSubmitting, onClose, open]);

  const parentOptions = useMemo(
    () =>
      categories
        .filter((category) => !invalidParentIds.has(category.id))
        .sort((a, b) => a.path.localeCompare(b.path)),
    [categories, invalidParentIds],
  );
  const parent = categories.find((category) => category.id === form.parentId) ?? null;
  const slugPreview = editing?.slug || slugifyPreview(form.name) || "category";
  const pathPreview = parent ? `${parent.path}/${slugPreview}` : slugPreview;

  return (
    <>
      <button
        type="button"
        aria-label={i18n("Close category editor")}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-60 bg-gray-900/35 backdrop-blur-[1px] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-editor-title"
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "fixed inset-y-0 right-0 z-70 w-full max-w-lg border-s border-brand-border bg-brand-white shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="relative border-b border-brand-border bg-brand-black px-5 py-4 pe-14 text-brand-white">
            <h2 id="category-editor-title" className="text-lg font-bold">
              {mode === "create" ? i18n("Add Category") : i18n("Edit Category")}
            </h2>
            <p className="mt-0.5 text-xs text-brand-white/70">
              {mode === "create"
                ? i18n("Create a root category or place it anywhere in the catalog tree.")
                : i18n("Update details, visibility, position, or move this subtree.")}
            </p>
            <button
              type="button"
              aria-label={i18n("Close editor")}
              disabled={isSubmitting}
              onClick={onClose}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <Field label={i18n("Name")} required>
                <input
                  ref={nameRef}
                  value={form.name}
                  onChange={(event) => onChange((prev) => ({ ...prev, name: event.target.value }))}
                  className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                  placeholder={i18n("Category name")}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
                <Field label={i18n("Parent category")}>
                  <select
                    value={form.parentId}
                    onChange={(event) => onChange((prev) => ({ ...prev, parentId: event.target.value }))}
                    className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                  >
                    <option value="">{i18n("Root category")}</option>
                    {parentOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {categoryLabel(category)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={i18n("Position")} required>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.position}
                    onChange={(event) => onChange((prev) => ({ ...prev, position: event.target.value }))}
                    className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                  />
                </Field>
              </div>

              <Field label={i18n("Status")} required>
                <select
                  value={form.status}
                  onChange={(event) =>
                    onChange((prev) => ({ ...prev, status: event.target.value as CategoryStatus }))
                  }
                  className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                >
                  {STATUS_VALUES.map((status) => <option key={status}>{status}</option>)}
                </select>
                <p className="mt-1 text-xs text-brand-text-muted">
                  {i18n("Hiding a parent hides its complete subtree publicly without changing child statuses.")}</p>
              </Field>

              <Field label={i18n("Image")}>
                <ImageUploader
                  category="categories"
                  value={form.image}
                  onChange={(url) => onChange((prev) => ({ ...prev, image: url }))}
                  disabled={isSubmitting}
                />
              </Field>

              <Field label={i18n("Description")}>
                <textarea
                  value={form.description}
                  onChange={(event) => onChange((prev) => ({ ...prev, description: event.target.value }))}
                  className="min-h-28 w-full rounded-xl border border-brand-border px-3 py-2 text-sm outline-none transition focus:border-brand-red"
                  placeholder={i18n("What shoppers will find here")}
                />
              </Field>

              <div className="rounded-xl border border-brand-border p-4">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-brand-black">{i18n("Search and social")}</h3>
                  <p className="mt-1 text-xs text-brand-text-muted">
                    {i18n("Optional overrides for search results and shared links. Storefront defaults are used when these fields are empty.")}</p>
                </div>

                <div className="space-y-4">
                  <Field label={i18n("SEO title")}>
                    <input
                      value={form.seoTitle}
                      maxLength={70}
                      onChange={(event) =>
                        onChange((prev) => ({ ...prev, seoTitle: event.target.value }))
                      }
                      className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
                      placeholder={i18n("Category title for search results")}
                    />
                    <p className="mt-1 text-end text-xs text-brand-text-muted">
                      {form.seoTitle.length}/70
                    </p>
                  </Field>

                  <Field label={i18n("Meta description")}>
                    <textarea
                      value={form.metaDescription}
                      maxLength={320}
                      onChange={(event) =>
                        onChange((prev) => ({ ...prev, metaDescription: event.target.value }))
                      }
                      className="min-h-24 w-full rounded-xl border border-brand-border px-3 py-2 text-sm outline-none transition focus:border-brand-red"
                      placeholder={i18n("Summary shown by search engines")}
                    />
                    <p className="mt-1 text-end text-xs text-brand-text-muted">
                      {form.metaDescription.length}/320
                    </p>
                  </Field>

                  <Field label={i18n("Social image")}>
                    <ImageUploader
                      category="categories"
                      value={form.ogImage}
                      onChange={(url) => onChange((prev) => ({ ...prev, ogImage: url }))}
                      disabled={isSubmitting}
                    />
                  </Field>
                </div>
              </div>

              <div className="rounded-xl border border-brand-border bg-brand-light-bg p-3 text-xs text-brand-text-muted">
                <p className="font-semibold text-brand-black">{i18n("Canonical path preview")}</p>
                <p className="mt-1 break-all font-mono">/categories/{pathPreview}</p>
                {editing && form.parentId !== (editing.parentId ?? "") && (
                  <p className="mt-2 font-medium text-amber-700">
                    {i18n("Moving this category also changes every descendant URL.")}</p>
                )}
                {editing && form.name !== editing.name && (
                  <p className="mt-2 text-emerald-700">
                    {i18n("The existing slug remains stable when only the display name changes.")}</p>
                )}
              </div>
            </div>

            <div className="border-t border-brand-border bg-brand-white px-5 py-4">
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="h-10 rounded-xl border border-brand-border px-4 text-sm font-semibold text-brand-black transition hover:bg-brand-light-bg disabled:opacity-60"
                >
                  {i18n("Cancel")}</button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-red px-4 text-sm font-semibold text-brand-white transition hover:bg-brand-red-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <ButtonLoader label={mode === "create" ? i18n("Creating...") : i18n("Saving...")} />
                  ) : mode === "create" ? i18n("Create category") : i18n("Save changes")}
                </button>
              </div>
            </div>
          </form>
        </div>
      </aside>
    </>
  );
}

function slugifyPreview(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
