import type { ProductFormState } from "@/features/admin-products/api";

export type ProductFormFieldErrors = Record<string, string>;

/** Find every missing required value without rejecting a numeric zero. */
export function validateProductRequiredFields(
  form: ProductFormState,
  mode: "create" | "edit",
): ProductFormFieldErrors {
  const errors: ProductFormFieldErrors = {};
  const required = (key: string, value: string, message: string) => {
    if (!value.trim()) errors[key] = message;
  };

  required("name", form.name, "Product name is required.");
  if (mode === "edit") required("slug", form.slug, "Canonical URL slug is required.");
  required("categoryId", form.categoryId, "Category is required.");
  required("status", form.status, "Status is required.");
  required("salePrice", form.salePrice, "Sale price is required.");
  form.variants.forEach((variant, index) => {
    required(`variants.${index}.stock`, variant.stock, "Stock is required.");
  });

  return errors;
}
