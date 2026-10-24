"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

/**
 * Inline axis-restriction modifier — keeps drag movement vertical only.
 * Avoids the need for the optional @dnd-kit/modifiers peer package.
 */
const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
});

import type {
  ProductDescriptionBlock,
  ProductDescriptionBlockType,
  FeatureGridBlock,
  ImageTextBlock,
  RichTextBlock,
  SpecificationTableBlock,
} from "@/lib/types/product-description-blocks";
import SortableBlock from "./SortableBlock";
import AddBlockMenu from "./AddBlockMenu";
import RichTextBlockForm from "./blocks/RichTextBlockForm";
import FeatureGridBlockForm from "./blocks/FeatureGridBlockForm";
import ImageTextBlockForm from "./blocks/ImageTextBlockForm";
import SpecificationTableBlockForm from "./blocks/SpecificationTableBlockForm";

const MAX_BLOCKS = 30;

/** Factory: creates an initial block value for each type. */
function createBlock(type: ProductDescriptionBlockType): ProductDescriptionBlock {
  const base = {
    id: crypto.randomUUID(),
    isVisible: true,
    spacing: "medium" as const,
    containerStyle: "contained" as const,
  };
  switch (type) {
    case "richText":
      return { ...base, type: "richText", content: { type: "doc", content: [{ type: "paragraph" }] } };
    case "featureGrid":
      return { ...base, type: "featureGrid", heading: "", columns: 3, items: [] };
    case "imageText":
      return {
        ...base,
        type: "imageText",
        heading: "",
        description: "",
        imageUrl: "",
        imageAlt: "",
        imagePosition: "left",
        ctaLabel: "",
        ctaUrl: "",
      };
    case "specificationTable":
      return { ...base, type: "specificationTable", heading: "", rows: [] };
  }
}

type Props = {
  value: ProductDescriptionBlock[];
  onChange: (blocks: ProductDescriptionBlock[]) => void;
  disabled?: boolean;
};

/**
 * Top-level block-based description builder.
 *
 * - Drag-and-drop via dnd-kit (pointer + keyboard sensors).
 * - Uses stable block IDs as React keys.
 * - Memoized per-block updater to avoid recreating the full array unnecessarily.
 * - Lazy-loaded by ProductFormDrawer to avoid shipping editor code on public pages.
 */
export default function ProductDescriptionBuilder({
  value,
  onChange,
  disabled,
}: Props) {
  const i18n = useInterfaceTranslations("InterfaceProductDescriptionProductDescriptionBuilder");
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = value.findIndex((b) => b.id === active.id);
    const newIndex = value.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(value, oldIndex, newIndex));
  };

  const updateBlock = useCallback(
    (updated: ProductDescriptionBlock) => {
      onChange(value.map((b) => (b.id === updated.id ? updated : b)));
    },
    [value, onChange],
  );

  const addBlock = (type: ProductDescriptionBlockType) => {
    if (value.length >= MAX_BLOCKS) return;
    onChange([...value, createBlock(type)]);
  };

  const duplicateBlock = (id: string) => {
    if (value.length >= MAX_BLOCKS) return;
    const index = value.findIndex((b) => b.id === id);
    if (index === -1) return;
    const copy: ProductDescriptionBlock = { ...value[index], id: crypto.randomUUID() };
    const next = [...value];
    next.splice(index + 1, 0, copy);
    onChange(next);
  };

  const moveBlock = (id: string, direction: -1 | 1) => {
    const index = value.findIndex((b) => b.id === id);
    if (index === -1) return;
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= value.length) return;
    const next = [...value];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    onChange(next);
  };

  const toggleVisibility = (id: string) => {
    onChange(
      value.map((b) =>
        b.id === id ? { ...b, isVisible: !b.isVisible } : b,
      ),
    );
  };

  const deleteBlock = (id: string) => {
    onChange(value.filter((b) => b.id !== id));
  };

  const renderBlockForm = (block: ProductDescriptionBlock) => {
    switch (block.type) {
      case "richText":
        return (
          <RichTextBlockForm
            block={block as RichTextBlock}
            onChange={updateBlock}
            disabled={disabled}
          />
        );
      case "featureGrid":
        return (
          <FeatureGridBlockForm
            block={block as FeatureGridBlock}
            onChange={updateBlock}
            disabled={disabled}
          />
        );
      case "imageText":
        return (
          <ImageTextBlockForm
            block={block as ImageTextBlock}
            onChange={updateBlock}
            disabled={disabled}
          />
        );
      case "specificationTable":
        return (
          <SpecificationTableBlockForm
            block={block as SpecificationTableBlock}
            onChange={updateBlock}
            disabled={disabled}
          />
        );
    }
  };

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <div className="flex min-h-32 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-border bg-brand-light-bg px-6 py-8 text-center">
          <p className="text-sm font-semibold text-gray-600">
            {i18n("No content blocks yet")}</p>
          <p className="mt-1 text-xs text-gray-400">
            {i18n("Add your first block below to build the product description.")}</p>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={value.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          {value.map((block, index) => (
            <SortableBlock
              key={block.id}
              block={block}
              index={index}
              totalBlocks={value.length}
              onMoveUp={() => moveBlock(block.id, -1)}
              onMoveDown={() => moveBlock(block.id, 1)}
              onDuplicate={() => duplicateBlock(block.id)}
              onToggleVisibility={() => toggleVisibility(block.id)}
              onDelete={() => deleteBlock(block.id)}
            >
              {renderBlockForm(block)}
            </SortableBlock>
          ))}
        </SortableContext>
      </DndContext>

      <div className="flex items-center justify-between pt-1">
        <AddBlockMenu
          onAdd={addBlock}
          disabled={disabled || value.length >= MAX_BLOCKS}
        />
        {value.length > 0 && (
          <p className="text-xs text-gray-400">
            {value.length}/{MAX_BLOCKS} {i18n("blocks")}</p>
        )}
      </div>
    </div>
  );
}
