"use client";

import { useInterfaceTranslations } from "@/components/i18n/translate";
import React, { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/lib/utils";
import type { ProductDescriptionBlock } from "@/lib/types/product-description-blocks";

import BlockActions from "./BlockActions";

type SortableBlockProps = {
  block: ProductDescriptionBlock;
  index: number;
  totalBlocks: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
  children: React.ReactNode;
};

/**
 * Wrapper that makes a block sortable via dnd-kit.
 * Memoized — only re-renders when props change.
 */
const SortableBlock = memo(function SortableBlock({
  block,
  index,
  totalBlocks,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onToggleVisibility,
  onDelete,
  children,
}: SortableBlockProps) {
  const i18n = useInterfaceTranslations("InterfaceMessages");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const blockTypeLabel: Record<ProductDescriptionBlock["type"], string> = {
    richText: "Rich Text",
    featureGrid: "Feature Grid",
    imageText: "Image & Text",
    specificationTable: "Specification Table",
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-2xl border border-brand-border bg-white transition-shadow",
        isDragging && "shadow-2xl ring-2 ring-brand-red/30",
        !block.isVisible && "opacity-70",
      )}
      aria-label={i18n("{type} block", { type: i18n(blockTypeLabel[block.type]) })}
    >
      {/* Block header */}
      <div className="flex items-center justify-between gap-3 border-b border-brand-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-red">
            {i18n(blockTypeLabel[block.type])}
          </span>
        </div>
        <BlockActions
          isVisible={block.isVisible}
          canMoveUp={index > 0}
          canMoveDown={index < totalBlocks - 1}
          dragHandleListeners={listeners as Record<string, unknown>}
          dragHandleAttributes={attributes as unknown as Record<string, unknown>}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDuplicate={onDuplicate}
          onToggleVisibility={onToggleVisibility}
          onDelete={onDelete}
        />
      </div>

      {/* Block form content */}
      <div className="p-4">{children}</div>
    </article>
  );
});

SortableBlock.displayName = "SortableBlock";

export default SortableBlock;
