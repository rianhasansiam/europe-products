"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Plus, Copy, Trash2, GripVertical } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import {
  APPROVED_FEATURE_ICONS,
  type FeatureGridBlock,
  type FeatureGridItem,
} from "@/lib/types/product-description-blocks";
import BlockCommonControls from "@/components/product-description/BlockCommonControls";

const inputClass =
  "h-10 w-full rounded-xl border border-brand-border bg-white px-3 text-sm outline-none transition focus:border-brand-red disabled:cursor-not-allowed disabled:bg-gray-50";

const textareaClass =
  "w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-red disabled:cursor-not-allowed disabled:bg-gray-50 resize-none";

type Props = {
  block: FeatureGridBlock;
  onChange: (updated: FeatureGridBlock) => void;
  disabled?: boolean;
};

function newItem(): FeatureGridItem {
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    icon: undefined,
  };
}

function IconOption({ name }: { name: string }) {
  // Dynamically look up the Lucide icon
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name];
  if (!Icon) return <span className="text-xs text-gray-400">{name}</span>;
  return (
    <span className="flex items-center gap-1.5 text-sm text-gray-700">
      <Icon className="h-4 w-4 shrink-0" />
      {name}
    </span>
  );
}

export default function FeatureGridBlockForm({
  block,
  onChange,
  disabled,
}: Props) {
  const i18n = useInterfaceTranslations("InterfaceProductDescriptionBlocksFeatureGridBlockForm");
  const patch = (fields: Partial<FeatureGridBlock>) =>
    onChange({ ...block, ...fields });

  const patchItem = (id: string, fields: Partial<FeatureGridItem>) => {
    onChange({
      ...block,
      items: block.items.map((item) =>
        item.id === id ? { ...item, ...fields } : item,
      ),
    });
  };

  const addItem = () => {
    if (block.items.length >= 20) return;
    patch({ items: [...block.items, newItem()] });
  };

  const duplicateItem = (id: string) => {
    if (block.items.length >= 20) return;
    const index = block.items.findIndex((i) => i.id === id);
    if (index === -1) return;
    const copy: FeatureGridItem = {
      ...block.items[index],
      id: crypto.randomUUID(),
    };
    const next = [...block.items];
    next.splice(index + 1, 0, copy);
    patch({ items: next });
  };

  const deleteItem = (id: string) => {
    patch({ items: block.items.filter((i) => i.id !== id) });
  };

  const moveItem = (id: string, direction: -1 | 1) => {
    const index = block.items.findIndex((i) => i.id === id);
    if (index === -1) return;
    const next = [...block.items];
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    patch({ items: next });
  };

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) =>
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      {/* Section heading */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          {i18n("Section heading (optional)")}</label>
        <input
          type="text"
          value={block.heading ?? ""}
          onChange={(e) => patch({ heading: e.target.value || undefined })}
          placeholder={i18n("e.g. Why choose us?")}
          maxLength={200}
          disabled={disabled}
          className={cn(inputClass)}
        />
      </div>

      {/* Columns */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          {i18n("Columns")}</label>
        <div className="flex gap-2">
          {([2, 3, 4] as const).map((col) => (
            <button
              key={col}
              type="button"
              onClick={() => patch({ columns: col })}
              disabled={disabled}
              className={cn(
                "h-9 w-14 rounded-xl border text-sm font-semibold transition",
                block.columns === col
                  ? "border-brand-red bg-brand-red text-white"
                  : "border-brand-border text-gray-700 hover:border-brand-red hover:text-brand-red",
              )}
            >
              {col}
            </button>
          ))}
        </div>
      </div>

      {/* Feature items */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {i18n("Feature items (")}{block.items.length}/20)
        </p>
        <div className="space-y-2">
          {block.items.map((item, index) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-xl border border-brand-border bg-brand-light-bg"
            >
              {/* Item header */}
              <div className="flex items-center gap-2 px-3 py-2">
                <GripVertical className="h-4 w-4 shrink-0 text-gray-400" />
                <button
                  type="button"
                  onClick={() => toggleExpand(item.id)}
                  className="flex-1 text-start text-sm font-semibold text-gray-800 truncate"
                >
                  {item.title || <span className="text-gray-400 font-normal">{i18n("Untitled feature")}</span>}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveItem(item.id, -1)}
                    disabled={disabled || index === 0}
                    title={i18n("Move up")}
                    className="rounded p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(item.id, 1)}
                    disabled={disabled || index === block.items.length - 1}
                    title={i18n("Move down")}
                    className="rounded p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateItem(item.id)}
                    disabled={disabled || block.items.length >= 20}
                    title={i18n("Duplicate")}
                    className="rounded p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteItem(item.id)}
                    disabled={disabled}
                    title={i18n("Delete")}
                    className="rounded p-1 text-red-400 hover:text-red-600 disabled:opacity-30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Expanded fields */}
              {expandedItems.has(item.id) && (
                <div className="space-y-3 border-t border-brand-border p-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">
                      {i18n("Title *")}</label>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) =>
                        patchItem(item.id, { title: e.target.value })
                      }
                      placeholder={i18n("Feature title")}
                      maxLength={150}
                      disabled={disabled}
                      className={cn(inputClass, "bg-white")}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">
                      {i18n("Description (optional)")}</label>
                    <textarea
                      rows={2}
                      value={item.description ?? ""}
                      onChange={(e) =>
                        patchItem(item.id, {
                          description: e.target.value || undefined,
                        })
                      }
                      placeholder={i18n("Brief supporting text…")}
                      maxLength={500}
                      disabled={disabled}
                      className={cn(textareaClass, "bg-white")}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">
                      {i18n("Icon (optional)")}</label>
                    <select
                      value={item.icon ?? ""}
                      onChange={(e) =>
                        patchItem(item.id, {
                          icon: e.target.value || undefined,
                        })
                      }
                      disabled={disabled}
                      className={cn(inputClass, "bg-white")}
                    >
                      <option value="">{i18n("No icon")}</option>
                      {APPROVED_FEATURE_ICONS.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    {item.icon && (
                      <div className="mt-1.5">
                        <IconOption name={item.icon} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addItem}
          disabled={disabled || block.items.length >= 20}
          className="mt-2 inline-flex h-9 items-center gap-2 rounded-xl border border-dashed border-brand-border px-3 text-sm font-semibold text-gray-600 transition hover:border-brand-red hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {i18n("Add feature item")}</button>
      </div>

      <BlockCommonControls
        block={block}
        onChange={(fields) => patch(fields)}
        disabled={disabled}
      />
    </div>
  );
}
