"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useEffect, useRef, lazy, Suspense } from "react";
import { Boxes, Plus, Trash2, X } from "lucide-react";

const ProductDescriptionBuilder = lazy(
  () => import("@/components/product-description/ProductDescriptionBuilder"),
);

import ImageUploader from "@/components/ui/ImageUploader";
import MultiImageUploader from "@/components/ui/MultiImageUploader";
import AdvancedColorPicker from "@/components/ui/AdvancedColorPicker";
import { ButtonLoader } from "@/components/ui/loading";
import type { CatalogEntityOption } from "@/features/admin-catalog-entities/api";
import {
  makeEmptyKeyValue,
  makeEmptyVariant,
  normalizeImagesInput,
  type CategoryOption,
  type KeyValueFormRow,
  type ProductFormState,
  type VariantFormRow,
} from "@/features/admin-products/api";
import type { ProductDescriptionBlock } from "@/lib/types/product-description-blocks";
import {
  isValidProductColor,
  normalizeProductColor,
  PRODUCT_COLOR_MAX_LENGTH,
  PRODUCT_COLOR_VALIDATION_MESSAGE,
} from "@/lib/catalog/product-color";
import { cn } from "@/lib/utils";

import Field from "./Field";

const inputClass =
  "h-10 w-full rounded-xl border border-brand-border bg-white px-3 text-sm outline-none transition focus:border-brand-red disabled:cursor-not-allowed disabled:bg-gray-50";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-brand-border bg-brand-light-bg/60 p-4">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-gray-950">{title}</h3>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
  addLabel,
}: {
  rows: KeyValueFormRow[];
  onChange: (rows: KeyValueFormRow[]) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
  addLabel: string;
}) {
  const i18n = useInterfaceTranslations("AdminAdminProductsComponentsProductFormDrawer");
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_2.5rem] gap-2">
          <input
            value={row.key}
            onChange={(event) =>
              onChange(rows.map((item, itemIndex) =>
                itemIndex === index ? { ...item, key: event.target.value } : item,
              ))
            }
            className={inputClass}
            placeholder={keyPlaceholder}
            aria-label={`${addLabel} name ${index + 1}`}
          />
          <input
            value={row.value}
            onChange={(event) =>
              onChange(rows.map((item, itemIndex) =>
                itemIndex === index ? { ...item, value: event.target.value } : item,
              ))
            }
            className={inputClass}
            placeholder={valuePlaceholder}
            aria-label={`${addLabel} value ${index + 1}`}
          />
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, itemIndex) => itemIndex !== index))}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50"
            aria-label={`Remove ${addLabel.toLowerCase()} ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, makeEmptyKeyValue()])}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-brand-border bg-white px-3 text-xs font-semibold text-gray-700 hover:border-brand-red/40 hover:text-brand-red"
      >
        <Plus className="h-3.5 w-3.5" />
        {i18n("Add")}{" "}{addLabel.toLowerCase()}
      </button>
    </div>
  );
}

export default function ProductFormDrawer({
  open,
  mode,
  form,
  originalVariantColors,
  categories,
  currentCategory,
  brands,
  manufacturers,
  error,
  isSubmitting,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  form: ProductFormState;
  originalVariantColors: ReadonlyMap<string, string | null>;
  categories: CategoryOption[];
  currentCategory: { id: string; label: string } | null;
  brands: CatalogEntityOption[];
  manufacturers: CatalogEntityOption[];
  error: string | null;
  isSubmitting: boolean;
  onChange: React.Dispatch<React.SetStateAction<ProductFormState>>;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const i18n = useInterfaceTranslations("AdminAdminProductsComponentsProductFormDrawer");
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isSubmitting, onClose, open]);

  const updateVariant = (index: number, patch: Partial<VariantFormRow>) => {
    onChange((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...patch } : variant,
      ),
    }));
  };

  return (
    <>
      <button
        type="button"
        aria-label={i18n("Close product editor")}
        aria-hidden={!open}
        inert={!open}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-60 border-0 bg-black/40 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-drawer-title"
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "fixed inset-y-0 right-0 z-70 flex w-full max-w-3xl flex-col border-s border-brand-border bg-white shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-start justify-between border-b border-brand-border px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-red">{i18n("Catalog product")}</p>
            <h2 id="product-drawer-title" className="mt-1 text-xl font-black text-gray-950">
              {mode === "create" ? i18n("Create product") : i18n("Edit product")}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl p-2 text-gray-500 hover:bg-brand-light-bg hover:text-brand-red disabled:opacity-50"
            aria-label={i18n("Close product editor")}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {i18n(error)}
              </div>
            )}

            <Section title={i18n("Classification")} description={i18n("Place the product in the catalog and record its technical identity.")}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label={i18n("Product name")} required>
                    <input
                      value={form.name}
                      onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))}
                      className={inputClass}
                      placeholder={i18n("Industrial air compressor")}
                    />
                  </Field>
                </div>
                {mode === "edit" && (
                  <div className="sm:col-span-2">
                    <Field label={i18n("Canonical URL slug")} required>
                      <input
                        value={form.slug}
                        onChange={(event) => onChange((current) => ({
                          ...current,
                          slug: event.target.value,
                        }))}
                        className={inputClass}
                        placeholder="industrial-air-compressor"
                        maxLength={160}
                        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                        autoCapitalize="none"
                        spellCheck={false}
                      />
                    </Field>
                    <p className="mt-1 text-xs text-gray-500">
                      {i18n("Changing this moves the product URL and keeps the previous URL as a permanent redirect.")}</p>
                  </div>
                )}
                <Field label={i18n("Category")} required>
                  <select
                    value={form.categoryId}
                    onChange={(event) => onChange((current) => ({ ...current, categoryId: event.target.value }))}
                    className={inputClass}
                  >
                    <option value="">{i18n("Select category")}</option>
                    {currentCategory &&
                      !categories.some(
                        (category) => category.id === currentCategory.id,
                      ) && (
                        <option value={currentCategory.id} disabled>
                          {i18n("Current hidden category —")}{" "}{currentCategory.label}
                        </option>
                      )}
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label={i18n("Status")} required>
                  <select
                    value={form.status}
                    onChange={(event) => onChange((current) => ({
                      ...current,
                      status: event.target.value as ProductFormState["status"],
                    }))}
                    className={inputClass}
                  >
                    <option value="ACTIVE">{i18n("Active")}</option>
                    <option value="INACTIVE">{i18n("Inactive")}</option>
                  </select>
                </Field>
                <Field label={i18n("Brand")}>
                  <select
                    value={form.brandId}
                    onChange={(event) => onChange((current) => ({ ...current, brandId: event.target.value }))}
                    className={inputClass}
                  >
                    <option value="">{i18n("No brand")}</option>
                    {form.brandId && !brands.some((brand) => brand.value === form.brandId) && (
                      <option value={form.brandId} disabled>{i18n("Current inactive brand")}</option>
                    )}
                    {brands.map((brand) => <option key={brand.value} value={brand.value}>{brand.label}</option>)}
                  </select>
                </Field>
                <Field label={i18n("Manufacturer")}>
                  <select
                    value={form.manufacturerId}
                    onChange={(event) => onChange((current) => ({ ...current, manufacturerId: event.target.value }))}
                    className={inputClass}
                  >
                    <option value="">{i18n("No manufacturer")}</option>
                    {form.manufacturerId && !manufacturers.some((manufacturer) => manufacturer.value === form.manufacturerId) && (
                      <option value={form.manufacturerId} disabled>{i18n("Current inactive manufacturer")}</option>
                    )}
                    {manufacturers.map((manufacturer) => (
                      <option key={manufacturer.value} value={manufacturer.value}>{manufacturer.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label={i18n("Model number")}>
                  <input
                    value={form.modelNumber}
                    onChange={(event) => onChange((current) => ({ ...current, modelNumber: event.target.value }))}
                    className={inputClass}
                    placeholder={i18n("AC-2200")}
                  />
                </Field>
                <Field label={i18n("Series")}>
                  <input
                    value={form.series}
                    onChange={(event) => onChange((current) => ({ ...current, series: event.target.value }))}
                    className={inputClass}
                    placeholder={i18n("ProLine")}
                  />
                </Field>
                <Field label="GTIN">
                  <input
                    value={form.gtin}
                    onChange={(event) => onChange((current) => ({
                      ...current,
                      gtin: event.target.value,
                    }))}
                    className={inputClass}
                    placeholder="0123456789012"
                    maxLength={32}
                    inputMode="numeric"
                  />
                </Field>
                <Field label={i18n("Item condition")}>
                  <select
                    value={form.itemCondition}
                    onChange={(event) => onChange((current) => ({
                      ...current,
                      itemCondition: event.target.value as ProductFormState["itemCondition"],
                    }))}
                    className={inputClass}
                  >
                    <option value="NEW">{i18n("New")}</option>
                    <option value="REFURBISHED">{i18n("Refurbished")}</option>
                    <option value="USED">{i18n("Used")}</option>
                  </select>
                </Field>
              </div>
            </Section>

            <Section title={i18n("Pricing")} description={i18n("Buying price stays admin-only; sale and discount prices are customer-facing.")}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={i18n("Buying price")} required>
                  <input type="number" min="0" step="0.01" value={form.buyingPrice} onChange={(event) => onChange((current) => ({ ...current, buyingPrice: event.target.value }))} className={inputClass} />
                </Field>
                <Field label={i18n("Sale price")} required>
                  <input type="number" min="0" step="0.01" value={form.salePrice} onChange={(event) => onChange((current) => ({ ...current, salePrice: event.target.value }))} className={inputClass} />
                </Field>
                <Field label={i18n("Discount price")}>
                  <input type="number" min="0" step="0.01" value={form.discountPrice} onChange={(event) => onChange((current) => ({ ...current, discountPrice: event.target.value }))} className={inputClass} />
                </Field>
              </div>
            </Section>

            <Section title={i18n("Specifications")} description={i18n("Flexible technical facts shown as a table on the product page.")}>
              <KeyValueEditor
                rows={form.specifications}
                onChange={(specifications) => onChange((current) => ({ ...current, specifications }))}
                keyPlaceholder="Voltage"
                valuePlaceholder="220 V"
                addLabel="Specification"
              />
            </Section>

            <Section title={i18n("Variants")} description={i18n("Each row is one purchasable option combination. Leave all option fields blank only for a single default variant.")}>
              <div className="space-y-3">
                {form.variants.map((variant, index) => {
                  const variantId = variant.id;
                  const hasOriginalColor =
                    mode === "edit" &&
                    variantId !== undefined &&
                    originalVariantColors.has(variantId);
                  const originalColor =
                    hasOriginalColor && variantId !== undefined
                      ? originalVariantColors.get(variantId) ?? null
                      : null;
                  const colorWasUnchanged =
                    hasOriginalColor && variant.color === (originalColor ?? "");
                  const enteredColor = variant.color.trim();
                  const colorIsValid =
                    enteredColor.length === 0 ||
                    isValidProductColor(enteredColor);
                  const hasInvalidColor = !colorWasUnchanged && !colorIsValid;
                  const hasUnchangedLegacyColor =
                    colorWasUnchanged &&
                    enteredColor.length > 0 &&
                    !isValidProductColor(enteredColor);
                  const colorHelpId = `variant-${index + 1}-color-help`;

                  return (
                    <article key={index} className="rounded-2xl border border-brand-border bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-red/10 text-brand-red"><Boxes className="h-4 w-4" /></span>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">{i18n("Variant")}{" "}{index + 1}</h4>
                          <p className="text-[11px] text-gray-500">{i18n("SKU, stock and any option attributes")}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onChange((current) => ({
                          ...current,
                          variants: current.variants.filter((_, variantIndex) => variantIndex !== index),
                        }))}
                        disabled={form.variants.length === 1}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label={`Remove variant ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Field label={i18n("Option name")}><input value={variant.name} onChange={(event) => updateVariant(index, { name: event.target.value })} className={inputClass} placeholder={i18n("220 V / Single phase")} /></Field>
                      <Field label="SKU"><input value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} className={inputClass} placeholder={i18n("Optional unique SKU")} /></Field>
                      <Field label={i18n("Variant model")}><input value={variant.modelNumber} onChange={(event) => updateVariant(index, { modelNumber: event.target.value })} className={inputClass} placeholder={i18n("Optional")} /></Field>
                      <Field label={i18n("Stock")} required><input type="number" min="0" step="1" value={variant.stock} onChange={(event) => updateVariant(index, { stock: event.target.value })} className={inputClass} /></Field>
                      <Field label={i18n("Size shortcut")}><input value={variant.size} onChange={(event) => updateVariant(index, { size: event.target.value })} className={inputClass} placeholder={i18n("Optional")} /></Field>
                      <div className="space-y-1.5 sm:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                          {i18n("Color shortcut (name or HEX)")}</span>
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
                          <AdvancedColorPicker
                            label={`Variant ${index + 1} HEX color picker`}
                            alpha={false}
                            showHexInput={false}
                            value={variant.color}
                            onChange={(color) =>
                              updateVariant(index, {
                                color: normalizeProductColor(color),
                              })
                            }
                            disabled={isSubmitting}
                          />
                          <input
                            value={variant.color}
                            onChange={(event) =>
                              updateVariant(index, {
                                color: event.target.value,
                              })
                            }
                            onBlur={() => {
                              if (isValidProductColor(variant.color)) {
                                updateVariant(index, {
                                  color: normalizeProductColor(variant.color),
                                });
                              }
                            }}
                            disabled={isSubmitting}
                            spellCheck={false}
                            autoCapitalize="words"
                            inputMode="text"
                            maxLength={PRODUCT_COLOR_MAX_LENGTH}
                            aria-label={`Variant ${index + 1} color name or hex value`}
                            aria-invalid={hasInvalidColor}
                            aria-describedby={
                              hasInvalidColor || hasUnchangedLegacyColor
                                ? colorHelpId
                                : undefined
                            }
                            className={cn(
                              inputClass,
                              "text-xs font-semibold",
                              hasInvalidColor &&
                                "border-red-300 focus:border-red-500",
                            )}
                            placeholder={i18n("Black or #112233")}
                          />
                        </div>
                        {hasInvalidColor && (
                          <p
                            id={colorHelpId}
                            role="alert"
                            className="text-[11px] font-semibold text-red-600"
                          >
                            {PRODUCT_COLOR_VALIDATION_MESSAGE}
                          </p>
                        )}
                        {hasUnchangedLegacyColor && (
                          <p id={colorHelpId} className="text-[11px] text-amber-700">
                            {i18n("Existing color format preserved. Leave it unchanged or replace it with a name or #RRGGBB.")}</p>
                        )}
                      </div>
                      <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-gray-700">
                        <input type="checkbox" checked={variant.isActive} onChange={(event) => updateVariant(index, { isActive: event.target.checked })} className="h-4 w-4 accent-brand-red" /> {i18n("Active")}</label>
                    </div>
                    <div className="mt-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">{i18n("Custom option attributes")}</p>
                      <KeyValueEditor
                        rows={variant.attributes}
                        onChange={(attributes) => updateVariant(index, { attributes })}
                        keyPlaceholder="Voltage"
                        valuePlaceholder="220 V"
                        addLabel="Attribute"
                      />
                    </div>
                    <div className="mt-3">
                      <Field label={i18n("Variant image")}><ImageUploader category="products" value={variant.image} onChange={(image) => updateVariant(index, { image })} disabled={isSubmitting} /></Field>
                    </div>
                    </article>
                  );
                })}
                <button
                  type="button"
                  onClick={() => onChange((current) => ({ ...current, variants: [...current.variants, makeEmptyVariant()] }))}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold text-gray-700 hover:border-brand-red/40 hover:text-brand-red"
                >
                  <Plus className="h-4 w-4" /> {i18n("Add variant")}</button>
              </div>
            </Section>

            <Section title={i18n("Media")} description={i18n("The first gallery image is used as the storefront card image.")}>
              <div className="space-y-4">
                <Field label={i18n("Primary image")}><ImageUploader category="products" value={form.image} onChange={(image) => onChange((current) => ({ ...current, image }))} disabled={isSubmitting} /></Field>
                <Field label={i18n("Primary image alt text")}>
                  <input
                    value={form.primaryImageAlt}
                    onChange={(event) => onChange((current) => ({
                      ...current,
                      primaryImageAlt: event.target.value,
                    }))}
                    className={inputClass}
                    placeholder={i18n("Industrial air compressor viewed from the front")}
                    maxLength={250}
                  />
                </Field>
                <Field label={i18n("Gallery images")}><MultiImageUploader category="products" value={normalizeImagesInput(form.images)} onChange={(images) => onChange((current) => ({ ...current, images: images.join("\n") }))} disabled={isSubmitting} /></Field>
              </div>
            </Section>

            <Section title={i18n("Search and sharing")} description={i18n("Optional overrides for search result snippets and social previews.")}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label={i18n("SEO title")}>
                    <input
                      value={form.seoTitle}
                      onChange={(event) => onChange((current) => ({
                        ...current,
                        seoTitle: event.target.value,
                      }))}
                      className={inputClass}
                      placeholder={i18n("Industrial Air Compressor | SexToy")}
                      maxLength={70}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label={i18n("Meta description")}>
                    <textarea
                      value={form.metaDescription}
                      onChange={(event) => onChange((current) => ({
                        ...current,
                        metaDescription: event.target.value,
                      }))}
                      className="min-h-24 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-red"
                      placeholder={i18n("Summarize the product for search results.")}
                      maxLength={320}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label={i18n("Social preview image")}>
                    <ImageUploader
                      category="products"
                      value={form.ogImage}
                      onChange={(ogImage) => onChange((current) => ({
                        ...current,
                        ogImage,
                      }))}
                      disabled={isSubmitting}
                    />
                  </Field>
                </div>
              </div>
            </Section>

            <Section title={i18n("Description")} description={i18n("Build the product description by adding, editing, and reordering content blocks. Blocks are stored as structured data — not raw HTML.")}>
              <Suspense fallback={
                <div className="flex h-32 items-center justify-center rounded-2xl border border-brand-border bg-brand-light-bg">
                  <span className="text-sm text-gray-400">{"Loading editor…"}</span>
                </div>
              }>
                <ProductDescriptionBuilder
                  value={form.descriptionBlocks as ProductDescriptionBlock[]}
                  onChange={(blocks) =>
                    onChange((current) => ({ ...current, descriptionBlocks: blocks }))
                  }
                  disabled={isSubmitting}
                />
              </Suspense>
            </Section>
          </div>

          <footer className="border-t border-brand-border bg-white px-5 py-4">
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} disabled={isSubmitting} className="h-10 rounded-xl border border-brand-border px-4 text-sm font-semibold text-gray-700 hover:bg-brand-light-bg disabled:opacity-50">{i18n("Cancel")}</button>
              <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="inline-flex h-10 items-center rounded-xl bg-brand-red px-4 text-sm font-semibold text-white hover:bg-brand-red-hover disabled:opacity-60">
                {isSubmitting ? <ButtonLoader label={i18n("Saving...")} /> : mode === "create" ? i18n("Create product") : i18n("Save changes")}
              </button>
            </div>
          </footer>
        </form>
      </aside>
    </>
  );
}
