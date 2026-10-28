import { describe, expect, it } from "vitest";

import { EMPTY_FORM, makeEmptyVariant, type ProductFormState } from "@/features/admin-products/api";
import { validateProductRequiredFields } from "@/features/admin-products/required-fields";

function validForm(): ProductFormState {
  return {
    ...EMPTY_FORM,
    name: "Product",
    categoryId: "category-1",
    salePrice: "10",
    variants: [makeEmptyVariant()],
  };
}

describe("required product form fields", () => {
  it("collects all blank and whitespace-only required inputs in one result", () => {
    const form = {
      ...validForm(),
      name: " \t ", categoryId: " ", salePrice: "\n",
      status: "" as ProductFormState["status"],
      variants: [{ ...makeEmptyVariant(), stock: "" }, { ...makeEmptyVariant(), stock: " \t " }],
    };

    expect(validateProductRequiredFields(form, "create")).toEqual({
      name: "Product name is required.",
      categoryId: "Category is required.",
      status: "Status is required.",
      salePrice: "Sale price is required.",
      "variants.0.stock": "Stock is required.",
      "variants.1.stock": "Stock is required.",
    });
  });

  it("accepts zero prices and zero stock while optional inputs stay empty", () => {
    const form = { ...validForm(), salePrice: " 0 ", variants: [{ ...makeEmptyVariant(), stock: " 0 " }] };
    expect(validateProductRequiredFields(form, "create")).toEqual({});
    expect(form.discountPrice).toBe("");
    expect(form.variants[0].color).toBe("");
    expect(form.variants[0].sku).toBe("");
  });

  it("requires the canonical slug only when editing", () => {
    const form = { ...validForm(), slug: " \t " };
    expect(validateProductRequiredFields(form, "create")).toEqual({});
    expect(validateProductRequiredFields(form, "edit")).toEqual({ slug: "Canonical URL slug is required." });
    expect(validateProductRequiredFields({ ...form, slug: "product" }, "edit")).toEqual({});
  });

  it("clears corrected errors and assigns stock errors to the current variant positions", () => {
    const first = { ...makeEmptyVariant(), stock: "" };
    const second = { ...makeEmptyVariant(), stock: "0" };
    const form = { ...validForm(), variants: [first, second] };
    expect(validateProductRequiredFields(form, "create")).toEqual({ "variants.0.stock": "Stock is required." });
    expect(validateProductRequiredFields({ ...form, variants: [second, first] }, "create")).toEqual({ "variants.1.stock": "Stock is required." });
    expect(validateProductRequiredFields({ ...form, variants: [second] }, "create")).toEqual({});
  });

  it("leaves nonempty value validation to the existing product validators", () => {
    const form = { ...validForm(), name: "X", slug: "UPPER CASE", salePrice: "-1", variants: [{ ...makeEmptyVariant(), stock: "1.5" }] };
    expect(validateProductRequiredFields(form, "edit")).toEqual({});
  });
});
