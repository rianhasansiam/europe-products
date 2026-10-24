import { describe, expect, it } from "vitest";

import {
  PRODUCT_COLOR_VALIDATION_MESSAGE,
  resolveProductColorWrite,
} from "@/lib/catalog/product-color";
import {
  createProductSchema,
  updateProductSchema,
} from "@/lib/validations/product.validation";

function createProductWithVariants(
  variants: Array<{
    color?: string | null;
    size?: string | null;
    sku?: string | null;
    stock?: number;
  }>,
) {
  return {
    name: "Test product",
    buyingPrice: 100,
    salePrice: 120,
    categoryId: "category-1",
    variants,
  };
}

function validationMessages(result: ReturnType<typeof createProductSchema.safeParse>) {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("create product color validation", () => {
  it("accepts a strict six-digit HEX color and normalizes it to uppercase", () => {
    const result = createProductSchema.safeParse(
      createProductWithVariants([
        { color: "#1a2b3c", size: "M", sku: "SKU-1", stock: 5 },
      ]),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variants[0]?.color).toBe("#1A2B3C");
    }
  });

  it.each([
    ["simple name", "Black", "Black"],
    ["another simple name", "Pink", "Pink"],
    ["multi-word name", "  Rose   Gold  ", "Rose Gold"],
    ["compound name", "Black/Pink", "Black/Pink"],
  ])("accepts and normalizes a %s", (_label, color, expected) => {
    const result = createProductSchema.safeParse(
      createProductWithVariants([{ color, size: "M", stock: 5 }]),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variants[0]?.color).toBe(expected);
    }
  });

  it.each([
    ["three-digit HEX", "#FFF"],
    ["eight-digit HEX", "#112233FF"],
    ["missing hash", "112233"],
    ["non-HEX characters", "#12GG56"],
    ["wrong length", "#12345"],
    ["markup characters", "<Pink>"],
    ["overlong name", "A".repeat(41)],
  ])("rejects %s", (_label, color) => {
    const result = createProductSchema.safeParse(
      createProductWithVariants([{ color, size: "M", stock: 5 }]),
    );

    expect(result.success).toBe(false);
    expect(validationMessages(result)).toContain(
      PRODUCT_COLOR_VALIDATION_MESSAGE,
    );
  });
});

describe("resolveProductColorWrite", () => {
  it.each([
    ["named color", "Black"],
    ["three-digit HEX", "#FFF"],
    ["eight-digit HEX", "#112233ff"],
    ["lowercase six-digit HEX", "#a1b2c3"],
    ["legacy value with surrounding spaces", " Black "],
  ])("preserves an unchanged legacy %s exactly", (_label, color) => {
    expect(resolveProductColorWrite(color, { value: color })).toEqual({
      success: true,
      value: color,
    });
  });

  it.each([
    ["new color", "#a1b2c3", undefined],
    ["changed color", "#0f1e2d", { value: "Black" }],
  ])("uppercases a valid %s", (_label, color, stored) => {
    expect(resolveProductColorWrite(color, stored)).toEqual({
      success: true,
      value: color.toUpperCase(),
    });
  });

  it.each([
    ["new named color", "Black", undefined, "Black"],
    ["changed named color", "Pink", { value: "Black" }, "Pink"],
    ["spaced named color", "  Rose   Gold  ", undefined, "Rose Gold"],
  ])("accepts a %s", (_label, color, stored, expected) => {
    expect(resolveProductColorWrite(color, stored)).toEqual({
      success: true,
      value: expected,
    });
  });

  it.each([
    ["three-digit HEX", "#FFF"],
    ["eight-digit HEX", "#112233FF"],
    ["missing hash", "112233"],
    ["malformed HEX", "#12GG56"],
    ["markup characters", "<Pink>"],
  ])("rejects a new invalid %s", (_label, color) => {
    expect(resolveProductColorWrite(color)).toEqual({
      success: false,
      message: PRODUCT_COLOR_VALIDATION_MESSAGE,
    });
  });

  it.each([
    ["three-digit HEX", "#ABC"],
    ["eight-digit HEX", "#11223380"],
    ["missing hash", "AABBCC"],
    ["malformed HEX", "#ABCDEG"],
    ["markup characters", "Pink<script>"],
  ])("rejects a changed invalid %s", (_label, color) => {
    expect(resolveProductColorWrite(color, { value: "Black" })).toEqual({
      success: false,
      message: PRODUCT_COLOR_VALIDATION_MESSAGE,
    });
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
  ])("allows color removal with %s", (_label, color) => {
    expect(resolveProductColorWrite(color, { value: "Black" })).toEqual({
      success: true,
      value: color,
    });
  });
});

describe("update product color parsing", () => {
  it.each(["Black", "#FFF", "#112233FF"])(
    "keeps an id-bearing legacy value available for database comparison: %s",
    (color) => {
      const result = updateProductSchema.safeParse({
        variants: [{ id: "variant-1", color, stock: 0 }],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.variants?.[0]?.color).toBe(color);
      }
    },
  );

  it("normalizes a valid color on a new update variant", () => {
    const result = updateProductSchema.safeParse({
      variants: [{ color: "#a1b2c3", stock: 0 }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variants?.[0]?.color).toBe("#A1B2C3");
    }
  });

  it("accepts a named color on a new update variant", () => {
    const result = updateProductSchema.safeParse({
      variants: [{ color: "Pink", stock: 0 }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variants?.[0]?.color).toBe("Pink");
    }
  });

  it.each(["#FFF", "#112233FF", "112233", "<Black>"])(
    "rejects an invalid color on a new update variant: %s",
    (color) => {
      const result = updateProductSchema.safeParse({
        variants: [{ color, stock: 0 }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map((issue) => issue.message)).toContain(
          PRODUCT_COLOR_VALIDATION_MESSAGE,
        );
      }
    },
  );
});

describe("product variant uniqueness refinements", () => {
  it("still rejects duplicate size/color combinations", () => {
    const result = createProductSchema.safeParse(
      createProductWithVariants([
        { color: "#aabbcc", size: "M", sku: "SKU-1", stock: 5 },
        { color: "#AABBCC", size: "M", sku: "SKU-2", stock: 5 },
      ]),
    );

    expect(result.success).toBe(false);
    expect(validationMessages(result)).toContain(
      "Each option combination must be unique.",
    );
  });

  it("rejects duplicate named color combinations case-insensitively", () => {
    const result = createProductSchema.safeParse(
      createProductWithVariants([
        { color: "Black", size: "M", sku: "SKU-1", stock: 5 },
        { color: "black", size: "M", sku: "SKU-2", stock: 5 },
      ]),
    );

    expect(result.success).toBe(false);
    expect(validationMessages(result)).toContain(
      "Each option combination must be unique.",
    );
  });

  it("still rejects duplicate SKUs case-insensitively", () => {
    const result = createProductSchema.safeParse(
      createProductWithVariants([
        { color: "#AABBCC", size: "M", sku: "SKU-1", stock: 5 },
        { color: "#DDEEFF", size: "L", sku: "sku-1", stock: 5 },
      ]),
    );

    expect(result.success).toBe(false);
    expect(validationMessages(result)).toContain("Each SKU must be unique.");
  });
});
