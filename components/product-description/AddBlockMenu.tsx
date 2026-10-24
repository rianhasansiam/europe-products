"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Plus } from "lucide-react";
import { useState, useRef, useEffect } from "react";

import type { ProductDescriptionBlockType } from "@/lib/types/product-description-blocks";

const BLOCK_LABELS: Record<ProductDescriptionBlockType, string> = {
  richText: "Rich Text",
  featureGrid: "Feature Grid",
  imageText: "Image & Text",
  specificationTable: "Specification Table",
};

const BLOCK_DESCRIPTIONS: Record<ProductDescriptionBlockType, string> = {
  richText: "Formatted text with headings, lists, links and alignment",
  featureGrid: "Grid of feature highlights with icons",
  imageText: "Side-by-side image and text section",
  specificationTable: "Label/value table of technical specs",
};

type AddBlockMenuProps = {
  disabled?: boolean;
  onAdd: (type: ProductDescriptionBlockType) => void;
};

const BLOCK_TYPES: ProductDescriptionBlockType[] = [
  "richText",
  "featureGrid",
  "imageText",
  "specificationTable",
];

/**
 * Dropdown menu for adding a new block of any supported type.
 */
export default function AddBlockMenu({ disabled, onAdd }: AddBlockMenuProps) {
  const i18n = useInterfaceTranslations("InterfaceProductDescriptionAddBlockMenu");
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleAdd = (type: ProductDescriptionBlockType) => {
    onAdd(type);
    setOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        aria-expanded={open}
        aria-label={i18n("Add a new content block")}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-brand-border bg-white px-4 text-sm font-semibold text-gray-600 transition hover:border-brand-red hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        {i18n("Add content block")}</button>

      {open && (
        <div className="absolute bottom-full start-0 z-50 mb-2 w-72 overflow-hidden rounded-2xl border border-brand-border bg-white shadow-xl">
          <p className="border-b border-brand-border px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            {i18n("Choose block type")}</p>
          {BLOCK_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleAdd(type)}
              className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-start hover:bg-brand-light-bg"
            >
              <span className="text-sm font-semibold text-gray-900">
                {i18n(BLOCK_LABELS[type])}
              </span>
              <span className="text-xs text-gray-500">
                {i18n(BLOCK_DESCRIPTIONS[type])}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
