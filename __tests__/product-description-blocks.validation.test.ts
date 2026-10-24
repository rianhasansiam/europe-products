import { describe, it, expect } from "vitest";
import {
  richTextBlockSchema,
  featureGridBlockSchema,
  imageTextBlockSchema,
  specificationTableBlockSchema,
  productDescriptionBlockSchema,
  productDescriptionBlocksArraySchema,
} from "@/lib/validations/product-description-blocks.validation";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const baseBlock = {
  id: "block-1",
  isVisible: true,
  spacing: "medium" as const,
  containerStyle: "contained" as const,
};

const minimalRichText = {
  ...baseBlock,
  type: "richText" as const,
  content: { type: "doc", content: [{ type: "paragraph" }] },
};

const minimalFeatureGrid = {
  ...baseBlock,
  type: "featureGrid" as const,
  columns: 3 as const,
  items: [],
};

const minimalImageText = {
  ...baseBlock,
  type: "imageText" as const,
  imageUrl: "https://example.com/image.jpg",
  imageAlt: "A product photo",
  imagePosition: "left" as const,
};

const minimalSpecTable = {
  ...baseBlock,
  type: "specificationTable" as const,
  rows: [{ id: "row-1", label: "Voltage", value: "220 V" }],
};

// ──────────────────────────────────────────────────────────────────────────────
// Rich Text
// ──────────────────────────────────────────────────────────────────────────────

describe("richTextBlockSchema", () => {
  it("accepts a minimal valid block", () => {
    expect(richTextBlockSchema.safeParse(minimalRichText).success).toBe(true);
  });

  it("defaults isVisible to true when omitted", () => {
    const result = richTextBlockSchema.safeParse({
      ...minimalRichText,
      isVisible: undefined,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isVisible).toBe(true);
  });

  it("rejects when id is empty", () => {
    expect(
      richTextBlockSchema.safeParse({ ...minimalRichText, id: "" }).success,
    ).toBe(false);
  });

  it("rejects when content is a raw string", () => {
    expect(
      richTextBlockSchema.safeParse({
        ...minimalRichText,
        content: "<p>raw html</p>",
      }).success,
    ).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Feature Grid
// ──────────────────────────────────────────────────────────────────────────────

describe("featureGridBlockSchema", () => {
  it("accepts a minimal valid block", () => {
    expect(featureGridBlockSchema.safeParse(minimalFeatureGrid).success).toBe(
      true,
    );
  });

  it("accepts column counts 2, 3, 4", () => {
    for (const columns of [2, 3, 4] as const) {
      expect(
        featureGridBlockSchema.safeParse({ ...minimalFeatureGrid, columns })
          .success,
      ).toBe(true);
    }
  });

  it("rejects column count 5", () => {
    expect(
      featureGridBlockSchema.safeParse({ ...minimalFeatureGrid, columns: 5 })
        .success,
    ).toBe(false);
  });

  it("rejects items with empty title", () => {
    const result = featureGridBlockSchema.safeParse({
      ...minimalFeatureGrid,
      items: [{ id: "item-1", title: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a disallowed icon name", () => {
    const result = featureGridBlockSchema.safeParse({
      ...minimalFeatureGrid,
      items: [{ id: "item-1", title: "Fast", icon: "<script>alert(1)</script>" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 20 items", () => {
    const items = Array.from({ length: 21 }, (_, i) => ({
      id: `item-${i}`,
      title: `Feature ${i}`,
    }));
    expect(
      featureGridBlockSchema.safeParse({ ...minimalFeatureGrid, items }).success,
    ).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Image + Text
// ──────────────────────────────────────────────────────────────────────────────

describe("imageTextBlockSchema", () => {
  it("accepts a minimal valid block", () => {
    expect(imageTextBlockSchema.safeParse(minimalImageText).success).toBe(true);
  });

  it("rejects a javascript: URL in imageUrl", () => {
    expect(
      imageTextBlockSchema.safeParse({
        ...minimalImageText,
        imageUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("rejects a data: URL in ctaUrl", () => {
    expect(
      imageTextBlockSchema.safeParse({
        ...minimalImageText,
        ctaUrl: "data:text/html,<h1>xss</h1>",
      }).success,
    ).toBe(false);
  });

  it("accepts a root-relative ctaUrl", () => {
    expect(
      imageTextBlockSchema.safeParse({
        ...minimalImageText,
        ctaUrl: "/products/air-compressor",
      }).success,
    ).toBe(true);
  });

  it("rejects missing imageAlt", () => {
    expect(
      imageTextBlockSchema.safeParse({ ...minimalImageText, imageAlt: "" })
        .success,
    ).toBe(false);
  });

  it("rejects an invalid imagePosition", () => {
    expect(
      imageTextBlockSchema.safeParse({
        ...minimalImageText,
        imagePosition: "center",
      }).success,
    ).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Specification Table
// ──────────────────────────────────────────────────────────────────────────────

describe("specificationTableBlockSchema", () => {
  it("accepts a minimal valid block", () => {
    expect(
      specificationTableBlockSchema.safeParse(minimalSpecTable).success,
    ).toBe(true);
  });

  it("rejects a row with empty label", () => {
    expect(
      specificationTableBlockSchema.safeParse({
        ...minimalSpecTable,
        rows: [{ id: "row-1", label: "", value: "220 V" }],
      }).success,
    ).toBe(false);
  });

  it("rejects a row with empty value", () => {
    expect(
      specificationTableBlockSchema.safeParse({
        ...minimalSpecTable,
        rows: [{ id: "row-1", label: "Voltage", value: "" }],
      }).success,
    ).toBe(false);
  });

  it("rejects more than 50 rows", () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({
      id: `row-${i}`,
      label: `Label ${i}`,
      value: `Value ${i}`,
    }));
    expect(
      specificationTableBlockSchema.safeParse({ ...minimalSpecTable, rows })
        .success,
    ).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Discriminated union
// ──────────────────────────────────────────────────────────────────────────────

describe("productDescriptionBlockSchema (union)", () => {
  it("parses each block type by discriminant", () => {
    expect(
      productDescriptionBlockSchema.safeParse(minimalRichText).success,
    ).toBe(true);
    expect(
      productDescriptionBlockSchema.safeParse(minimalFeatureGrid).success,
    ).toBe(true);
    expect(
      productDescriptionBlockSchema.safeParse(minimalImageText).success,
    ).toBe(true);
    expect(
      productDescriptionBlockSchema.safeParse(minimalSpecTable).success,
    ).toBe(true);
  });

  it("rejects an unknown block type", () => {
    expect(
      productDescriptionBlockSchema.safeParse({
        ...baseBlock,
        type: "videoEmbed",
      }).success,
    ).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Array schema
// ──────────────────────────────────────────────────────────────────────────────

describe("productDescriptionBlocksArraySchema", () => {
  it("accepts null", () => {
    expect(productDescriptionBlocksArraySchema.safeParse(null).success).toBe(
      true,
    );
  });

  it("accepts an empty array", () => {
    expect(productDescriptionBlocksArraySchema.safeParse([]).success).toBe(
      true,
    );
  });

  it("accepts a mixed array of valid blocks", () => {
    expect(
      productDescriptionBlocksArraySchema.safeParse([
        minimalRichText,
        minimalFeatureGrid,
        minimalImageText,
        minimalSpecTable,
      ]).success,
    ).toBe(true);
  });

  it("rejects more than 30 blocks", () => {
    const blocks = Array.from({ length: 31 }, (_, i) => ({
      ...minimalRichText,
      id: `block-${i}`,
    }));
    expect(
      productDescriptionBlocksArraySchema.safeParse(blocks).success,
    ).toBe(false);
  });

  it("rejects an array containing an invalid block", () => {
    expect(
      productDescriptionBlocksArraySchema.safeParse([
        minimalRichText,
        { ...baseBlock, type: "unknownType" },
      ]).success,
    ).toBe(false);
  });
});
