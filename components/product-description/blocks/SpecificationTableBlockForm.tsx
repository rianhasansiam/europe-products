"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Plus, Copy, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  SpecificationTableBlock,
  SpecificationTableRow,
} from "@/lib/types/product-description-blocks";
import BlockCommonControls from "@/components/product-description/BlockCommonControls";

const inputClass =
  "h-10 w-full rounded-xl border border-brand-border bg-white px-3 text-sm outline-none transition focus:border-brand-red disabled:cursor-not-allowed disabled:bg-gray-50";

type Props = {
  block: SpecificationTableBlock;
  onChange: (updated: SpecificationTableBlock) => void;
  disabled?: boolean;
};

function newRow(): SpecificationTableRow {
  return { id: crypto.randomUUID(), label: "", value: "" };
}

export default function SpecificationTableBlockForm({
  block,
  onChange,
  disabled,
}: Props) {
  const i18n = useInterfaceTranslations("InterfaceProductDescriptionBlocksSpecificationTableBlockForm");
  const patch = (fields: Partial<SpecificationTableBlock>) =>
    onChange({ ...block, ...fields });

  const patchRow = (id: string, fields: Partial<SpecificationTableRow>) => {
    onChange({
      ...block,
      rows: block.rows.map((row) =>
        row.id === id ? { ...row, ...fields } : row,
      ),
    });
  };

  const addRow = () => {
    if (block.rows.length >= 50) return;
    patch({ rows: [...block.rows, newRow()] });
  };

  const duplicateRow = (id: string) => {
    if (block.rows.length >= 50) return;
    const index = block.rows.findIndex((r) => r.id === id);
    if (index === -1) return;
    const copy: SpecificationTableRow = { ...block.rows[index], id: crypto.randomUUID() };
    const next = [...block.rows];
    next.splice(index + 1, 0, copy);
    patch({ rows: next });
  };

  const deleteRow = (id: string) => {
    patch({ rows: block.rows.filter((r) => r.id !== id) });
  };

  const moveRow = (id: string, direction: -1 | 1) => {
    const index = block.rows.findIndex((r) => r.id === id);
    if (index === -1) return;
    const next = [...block.rows];
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    patch({ rows: next });
  };

  return (
    <div className="space-y-4">
      {/* Heading */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          {i18n("Section heading (optional)")}</label>
        <input
          type="text"
          value={block.heading ?? ""}
          onChange={(e) => patch({ heading: e.target.value || undefined })}
          placeholder={i18n("e.g. Technical Specifications")}
          maxLength={200}
          disabled={disabled}
          className={cn(inputClass)}
        />
      </div>

      {/* Rows */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {i18n("Specification rows (")}{block.rows.length}/50)
        </p>

        {block.rows.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-brand-border">
            {/* Header */}
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 border-b border-brand-border bg-brand-light-bg px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <span>{i18n("Label")}</span>
              <span>{i18n("Value")}</span>
              <span className="w-24 text-end">{i18n("Actions")}</span>
            </div>

            {block.rows.map((row, index) => (
              <div
                key={row.id}
                className={cn(
                  "grid grid-cols-[1fr_1fr_auto] items-center gap-2 px-3 py-2",
                  index % 2 === 1 && "bg-gray-50",
                  index < block.rows.length - 1 && "border-b border-brand-border",
                )}
              >
                <input
                  type="text"
                  value={row.label}
                  onChange={(e) => patchRow(row.id, { label: e.target.value })}
                  placeholder={i18n("Label")}
                  maxLength={150}
                  disabled={disabled}
                  className="h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm outline-none transition hover:border-brand-border focus:border-brand-red"
                />
                <input
                  type="text"
                  value={row.value}
                  onChange={(e) => patchRow(row.id, { value: e.target.value })}
                  placeholder={i18n("Value")}
                  maxLength={500}
                  disabled={disabled}
                  className="h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm outline-none transition hover:border-brand-border focus:border-brand-red"
                />
                <div className="flex w-24 items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => moveRow(row.id, -1)}
                    disabled={disabled || index === 0}
                    title={i18n("Move up")}
                    className="rounded p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveRow(row.id, 1)}
                    disabled={disabled || index === block.rows.length - 1}
                    title={i18n("Move down")}
                    className="rounded p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateRow(row.id)}
                    disabled={disabled || block.rows.length >= 50}
                    title={i18n("Duplicate")}
                    className="rounded p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRow(row.id)}
                    disabled={disabled}
                    title={i18n("Delete")}
                    className="rounded p-1 text-red-400 hover:text-red-600 disabled:opacity-30"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addRow}
          disabled={disabled || block.rows.length >= 50}
          className="mt-2 inline-flex h-9 items-center gap-2 rounded-xl border border-dashed border-brand-border px-3 text-sm font-semibold text-gray-600 transition hover:border-brand-red hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {i18n("Add row")}</button>
      </div>

      <BlockCommonControls
        block={block}
        onChange={(fields) => patch(fields)}
        disabled={disabled}
      />
    </div>
  );
}
