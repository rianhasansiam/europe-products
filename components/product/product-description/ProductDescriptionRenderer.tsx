import { cn } from "@/lib/utils";
import { productDescriptionBlockSchema } from "@/lib/validations/product-description-blocks.validation";
import type { ProductDescriptionBlock } from "@/lib/types/product-description-blocks";

import RichTextBlockView from "./blocks/RichTextBlockView";
import FeatureGridBlockView from "./blocks/FeatureGridBlockView";
import ImageTextBlockView from "./blocks/ImageTextBlockView";
import SpecificationTableBlockView from "./blocks/SpecificationTableBlockView";

const SPACING_CLASSES: Record<string, string> = {
  small: "py-4",
  medium: "py-8",
  large: "py-14",
};

const CONTAINER_CLASSES: Record<string, string> = {
  contained: "max-w-4xl mx-auto",
  fullWidth: "w-full",
};

/** Parse and validate an unknown value from Prisma JSON into typed blocks. */
function parseBlocks(raw: unknown): ProductDescriptionBlock[] {
  if (!raw || !Array.isArray(raw)) return [];
  const valid: ProductDescriptionBlock[] = [];
  for (const item of raw) {
    const result = productDescriptionBlockSchema.safeParse(item);
    if (result.success) {
      valid.push(result.data as ProductDescriptionBlock);
    } else {
      // Log only on the server — never expose to the client.
      console.warn(
        "[ProductDescriptionRenderer] Skipping malformed block:",
        JSON.stringify(item).slice(0, 200),
        result.error.flatten(),
      );
    }
  }
  return valid;
}

function BlockWrapper({
  block,
  children,
}: {
  block: ProductDescriptionBlock;
  children: React.ReactNode;
}) {
  const spacing = block.spacing ?? "medium";
  const container = block.containerStyle ?? "contained";

  return (
    <div
      className={cn(
        SPACING_CLASSES[spacing] ?? SPACING_CLASSES.medium,
        "w-full min-w-0",
      )}
    >
      <div
        className={cn(
          CONTAINER_CLASSES[container] ?? CONTAINER_CLASSES.contained,
          "min-w-0 px-4 sm:px-0",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Server Component: renders validated description blocks for the public product page.
 *
 * - Only renders blocks where `isVisible === true`.
 * - Exhaustive switch covers all 4 block types.
 * - Malformed blocks are skipped gracefully (logged server-side only).
 * - Falls back to plain `legacyDescription` when no valid blocks exist.
 * - Returns `null` when nothing renderable is present.
 */
export default function ProductDescriptionRenderer({
  blocks: rawBlocks,
  legacyDescription,
}: {
  blocks?: unknown;
  legacyDescription?: string | null;
}) {
  const blocks = parseBlocks(rawBlocks);
  const visibleBlocks = blocks.filter((b) => b.isVisible);

  // If we have valid visible blocks, render them.
  if (visibleBlocks.length > 0) {
    return (
      <div className="min-w-0 divide-y divide-brand-border overflow-hidden rounded-2xl border border-brand-border bg-white">
        {visibleBlocks.map((block) => {
          let blockNode: React.ReactNode;
          switch (block.type) {
            case "richText":
              blockNode = <RichTextBlockView block={block} />;
              break;
            case "featureGrid":
              blockNode = <FeatureGridBlockView block={block} />;
              break;
            case "imageText":
              blockNode = <ImageTextBlockView block={block} />;
              break;
            case "specificationTable":
              blockNode = <SpecificationTableBlockView block={block} />;
              break;
          }
          if (!blockNode) return null;
          return (
            <BlockWrapper key={block.id} block={block}>
              {blockNode}
            </BlockWrapper>
          );
        })}
      </div>
    );
  }

  // Fallback: render legacy plain-text description.
  const trimmed = legacyDescription?.trim();
  if (trimmed) {
    return (
      <div className="min-w-0 overflow-hidden rounded-2xl border border-brand-border bg-white">
        <p className="whitespace-pre-line px-4 py-6 leading-relaxed text-gray-600 [overflow-wrap:anywhere] sm:px-5">
          {trimmed}
        </p>
      </div>
    );
  }

  // Nothing to render.
  return null;
}
