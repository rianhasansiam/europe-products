import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderToStaticMarkup } from "./helpers/intl";
import ProductFormDrawer from "@/app/admin/products/components/ProductFormDrawer";
import { EMPTY_FORM, makeEmptyVariant, type ProductFormState } from "@/features/admin-products/api";
import { validateProductRequiredFields, type ProductFormFieldErrors } from "@/features/admin-products/required-fields";

vi.mock("@/components/product-description/ProductDescriptionBuilder", () => ({ default: () => null }));
vi.mock("@/components/ui/AdvancedColorPicker", () => ({ default: () => null }));
vi.mock("@/components/ui/ImageUploader", () => ({ default: () => null }));
vi.mock("@/components/ui/MultiImageUploader", () => ({ default: () => null }));

function render(
  form: ProductFormState,
  mode: "create" | "edit" = "create",
  fieldErrors: ProductFormFieldErrors = validateProductRequiredFields(form, mode),
): string {
  return renderToStaticMarkup(createElement(ProductFormDrawer, {
    open: true, mode, form, fieldErrors,
    originalVariantColors: new Map(), categories: [], currentCategory: null,
    error: null, isSubmitting: false,
    onChange: vi.fn(), onClose: vi.fn(), onSubmit: vi.fn(),
  }));
}

function fieldByName(markup: string, name: string): { field: string; control: string } {
  for (const match of markup.matchAll(/<label\b[^>]*>[\s\S]*?<\/label>/g)) {
    const control = (match[0].match(/<(?:input|select)\b[^>]*>/g) ?? [])
      .find((tag) => tag.includes(`name="${name}"`));
    if (control) return { field: match[0], control };
  }
  throw new Error(`No labeled control named ${name}`);
}

function expectInvalidField(markup: string, name: string, message: string) {
  const { field, control } = fieldByName(markup, name);
  const descriptionId = control.match(/aria-describedby="([^"]+)"/)?.[1];
  expect(control).toContain('required=""');
  expect(control).toContain('aria-invalid="true"');
  expect(control).toContain("aria-invalid:border-red-500");
  expect(descriptionId).toBeTruthy();
  expect(field).toContain(`id="${descriptionId}"`);
  expect(field).toContain(message);
  expect(field.match(/<span\b[^>]*>/)?.[0]).toContain("text-red-700");
  expect(field.match(/<p\b[^>]*>/)?.[0]).toContain("text-red-700");
}

function validForm(): ProductFormState {
  return {
    ...EMPTY_FORM, name: "Product", categoryId: "category-1", salePrice: "0",
    variants: [makeEmptyVariant()],
  };
}

describe("required product field feedback", () => {
  it("renders linked red feedback for every missing required value and leaves optional controls alone", () => {
    const form: ProductFormState = {
      ...EMPTY_FORM,
      status: "" as ProductFormState["status"],
      variants: [{ ...makeEmptyVariant(), stock: "" }, { ...makeEmptyVariant(), stock: "  " }],
    };
    const markup = render(form);
    expectInvalidField(markup, "name", "Product name is required.");
    expectInvalidField(markup, "categoryId", "Category is required.");
    expectInvalidField(markup, "status", "Status is required.");
    expectInvalidField(markup, "salePrice", "Sale price is required.");
    expectInvalidField(markup, "variants.0.stock", "Stock is required.");
    expectInvalidField(markup, "variants.1.stock", "Stock is required.");

    const optionalFields = [...markup.matchAll(/<label\b[^>]*>[\s\S]*?<\/label>/g)]
      .map((match) => match[0])
      .filter((field) => field.includes("Discount price") || field.includes("Model number") || field.includes("Option name"));
    expect(optionalFields.length).toBeGreaterThanOrEqual(3);
    for (const field of optionalFields) {
      const controls = field.match(/<input\b[^>]*>/g) ?? [];
      expect(controls.length).toBeGreaterThan(0);
      for (const control of controls) {
        expect(control).not.toContain('required=""');
        expect(control).not.toContain('aria-invalid="true"');
        expect(control).not.toContain("aria-describedby=");
      }
      expect(field.match(/<span\b[^>]*>/)?.[0]).toContain("text-gray-600");
    }
  });

  it("links the missing canonical slug error to its edit-only control", () => {
    const form = { ...validForm(), slug: " " };
    expectInvalidField(render(form, "edit"), "slug", "Canonical URL slug is required.");
    expect(render(form, "create")).not.toContain('name="slug"');
  });

  it("keeps required controls and red stars without marking untouched or corrected inputs invalid", () => {
    const form = validForm();
    for (const markup of [render(form), render({ ...form, name: "", salePrice: "" }, "create", {})]) {
      for (const name of ["name", "categoryId", "status", "salePrice", "variants.0.stock"]) {
        const { field, control } = fieldByName(markup, name);
        expect(control).toContain('required=""');
        expect(control).not.toContain('aria-invalid="true"');
        expect(control).not.toContain("aria-describedby=");
        expect(field).toContain('aria-hidden="true" class="text-red-600">*</span>');
        expect(field).not.toContain("is required.");
      }
    }
  });
});
