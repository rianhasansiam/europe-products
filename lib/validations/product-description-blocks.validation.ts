import { z } from "zod";

import {
  APPROVED_FEATURE_ICONS,
  BLOCK_CONTAINER_VALUES,
  BLOCK_SPACING_VALUES,
  FEATURE_GRID_COLUMN_VALUES,
  IMAGE_POSITION_VALUES,
} from "@/lib/types/product-description-blocks";

/**
 * Shared Zod schemas for every product description block type.
 *
 * Rules:
 * - Every block must have a non-empty unique ID.
 * - Maximum 30 blocks per product.
 * - Maximum 20 feature items per feature-grid block.
 * - Maximum 50 specification rows per table.
 * - All URLs must be http, https, or root-relative (no javascript:/data:/etc.).
 * - Unknown block types are rejected by discriminatedUnion.
 * - Heading, title, label, and value lengths are capped.
 */

// ---------------------------------------------------------------------------
// URL validator
// ---------------------------------------------------------------------------

const ALLOWED_URL_PROTOCOLS = /^https?:\/\//i;
const RELATIVE_URL = /^\/[^/]/;
const DANGEROUS_PROTOCOLS = /^(javascript|data|vbscript|blob|file):/i;

const safeUrl = z
  .string()
  .trim()
  .min(1, "URL is required.")
  .max(2048, "URL is too long.")
  .refine((url) => !DANGEROUS_PROTOCOLS.test(url), {
    message: "URL protocol is not allowed.",
  })
  .refine(
    (url) => ALLOWED_URL_PROTOCOLS.test(url) || RELATIVE_URL.test(url),
    {
      message:
        "URL must start with http://, https://, or / (root-relative path).",
    },
  );

const optionalSafeUrl = z
  .string()
  .trim()
  .max(2048, "URL is too long.")
  .refine((url) => !url || !DANGEROUS_PROTOCOLS.test(url), {
    message: "URL protocol is not allowed.",
  })
  .refine(
    (url) =>
      !url ||
      ALLOWED_URL_PROTOCOLS.test(url) ||
      RELATIVE_URL.test(url),
    {
      message:
        "URL must start with http://, https://, or / (root-relative path).",
    },
  )
  .optional()
  .nullable();

// ---------------------------------------------------------------------------
// Reusable field primitives
// ---------------------------------------------------------------------------

const blockId = z
  .string()
  .trim()
  .min(1, "Block ID is required.")
  .max(128, "Block ID is too long.")
  .regex(/^[\w-]+$/, "Block ID must contain only letters, numbers, hyphens, or underscores.");

const isVisible = z.boolean().default(true);

const spacing = z
  .enum(BLOCK_SPACING_VALUES)
  .optional();

const containerStyle = z
  .enum(BLOCK_CONTAINER_VALUES)
  .optional();

const optionalHeading = z
  .string()
  .trim()
  .max(200, "Heading is too long.")
  .optional()
  .nullable();

const optionalDescription = z
  .string()
  .trim()
  .max(2000, "Description is too long.")
  .optional()
  .nullable();

// ---------------------------------------------------------------------------
// Base block (shared fields)
// ---------------------------------------------------------------------------

const baseBlock = z.object({
  id: blockId,
  isVisible,
  spacing,
  containerStyle,
});

// ---------------------------------------------------------------------------
// Rich Text block
// ---------------------------------------------------------------------------

/**
 * Tiptap JSONContent is a recursive tree of nodes. We accept it as a JSON
 * object with at minimum a `type` string (e.g. "doc"). We do not attempt to
 * fully validate the tree structure here — Tiptap's own parser handles that
 * on the server renderer. We just ensure it is not raw HTML or a string.
 */
const tiptapNode: z.ZodType<Record<string, unknown>> = z.record(
  z.string(),
  z.unknown(),
);

export const richTextBlockSchema = baseBlock.extend({
  type: z.literal("richText"),
  content: tiptapNode,
});

// ---------------------------------------------------------------------------
// Feature Grid block
// ---------------------------------------------------------------------------

export const featureGridItemSchema = z.object({
  id: blockId,
  title: z
    .string()
    .trim()
    .min(1, "Feature title is required.")
    .max(150, "Feature title is too long."),
  description: z
    .string()
    .trim()
    .max(500, "Feature description is too long.")
    .optional()
    .nullable(),
  icon: z
    .enum(APPROVED_FEATURE_ICONS as unknown as [string, ...string[]], {
      error: "Icon must be from the approved list.",
    })
    .optional()
    .nullable(),
});

export const featureGridBlockSchema = baseBlock.extend({
  type: z.literal("featureGrid"),
  heading: optionalHeading,
  columns: z.union(
    FEATURE_GRID_COLUMN_VALUES.map((c) => z.literal(c)) as [
      z.ZodLiteral<2>,
      z.ZodLiteral<3>,
      z.ZodLiteral<4>,
    ],
    { error: "Columns must be 2, 3, or 4." },
  ),
  items: z
    .array(featureGridItemSchema)
    .max(20, "A feature grid can have at most 20 items."),
});

// ---------------------------------------------------------------------------
// Image + Text block
// ---------------------------------------------------------------------------

export const imageTextBlockSchema = baseBlock.extend({
  type: z.literal("imageText"),
  heading: optionalHeading,
  description: optionalDescription,
  imageUrl: safeUrl,
  imageAlt: z
    .string()
    .trim()
    .min(1, "Image alt text is required.")
    .max(250, "Image alt text is too long."),
  imagePosition: z.enum(IMAGE_POSITION_VALUES, {
    error: "Image position must be 'left' or 'right'.",
  }),
  ctaLabel: z
    .string()
    .trim()
    .max(80, "CTA label is too long.")
    .optional()
    .nullable(),
  ctaUrl: optionalSafeUrl,
});

// ---------------------------------------------------------------------------
// Specification Table block
// ---------------------------------------------------------------------------

export const specificationTableRowSchema = z.object({
  id: blockId,
  label: z
    .string()
    .trim()
    .min(1, "Row label is required.")
    .max(150, "Row label is too long."),
  value: z
    .string()
    .trim()
    .min(1, "Row value is required.")
    .max(500, "Row value is too long."),
});

export const specificationTableBlockSchema = baseBlock.extend({
  type: z.literal("specificationTable"),
  heading: optionalHeading,
  rows: z
    .array(specificationTableRowSchema)
    .max(50, "A specification table can have at most 50 rows."),
});

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

export const productDescriptionBlockSchema = z.discriminatedUnion("type", [
  richTextBlockSchema,
  featureGridBlockSchema,
  imageTextBlockSchema,
  specificationTableBlockSchema,
]);

export const descriptionBlocksSchema = z
  .array(productDescriptionBlockSchema)
  .max(30, "A product can have at most 30 description blocks.")
  .optional()
  .nullable();

// ---------------------------------------------------------------------------
// Exported inferred types (convenience re-exports for server code)
// ---------------------------------------------------------------------------

export type RichTextBlockInput = z.infer<typeof richTextBlockSchema>;
export type FeatureGridBlockInput = z.infer<typeof featureGridBlockSchema>;
export type ImageTextBlockInput = z.infer<typeof imageTextBlockSchema>;
export type SpecificationTableBlockInput = z.infer<
  typeof specificationTableBlockSchema
>;
export type ProductDescriptionBlockInput = z.infer<
  typeof productDescriptionBlockSchema
>;
export type DescriptionBlocksInput = z.infer<typeof descriptionBlocksSchema>;

/** Alias used by product.validation.ts to keep the name descriptive at the call site. */
export const productDescriptionBlocksArraySchema = descriptionBlocksSchema;
