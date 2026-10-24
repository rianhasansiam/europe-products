"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { cn } from "@/lib/utils";
import type {
  BaseBlock,
} from "@/lib/types/product-description-blocks";

const inputClass =
  "h-10 w-full rounded-xl border border-brand-border bg-white px-3 text-sm outline-none transition focus:border-brand-red disabled:cursor-not-allowed disabled:bg-gray-50";

type BlockCommonControlsProps = {
  block: Pick<BaseBlock, "isVisible" | "spacing" | "containerStyle">;
  onChange: (patch: Partial<Pick<BaseBlock, "isVisible" | "spacing" | "containerStyle">>) => void;
  disabled?: boolean;
};

/** Shared visibility, spacing, and container-style controls for every block. */
export default function BlockCommonControls({
  block,
  onChange,
  disabled,
}: BlockCommonControlsProps) {
  const i18n = useInterfaceTranslations("InterfaceProductDescriptionBlockCommonControls");
  return (
    <div className="mt-4 grid gap-3 border-t border-brand-border pt-4 sm:grid-cols-3">
      {/* Visibility */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {i18n("Visibility")}</p>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={block.isVisible}
            onChange={(e) => onChange({ isVisible: e.target.checked })}
            disabled={disabled}
            className="h-4 w-4 accent-brand-red"
          />
          <span className="text-sm text-gray-700">
            {block.isVisible ? i18n("Visible on public page") : i18n("Hidden from public page")}
          </span>
        </label>
      </div>

      {/* Spacing */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          {i18n("Block spacing")}</label>
        <select
          value={block.spacing ?? "medium"}
          onChange={(e) =>
            onChange({
              spacing: e.target.value as BaseBlock["spacing"],
            })
          }
          disabled={disabled}
          className={cn(inputClass)}
        >
          <option value="small">{i18n("Small")}</option>
          <option value="medium">{i18n("Medium (default)")}</option>
          <option value="large">{i18n("Large")}</option>
        </select>
      </div>

      {/* Container style */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          {i18n("Container style")}</label>
        <select
          value={block.containerStyle ?? "contained"}
          onChange={(e) =>
            onChange({
              containerStyle: e.target.value as BaseBlock["containerStyle"],
            })
          }
          disabled={disabled}
          className={cn(inputClass)}
        >
          <option value="contained">{i18n("Contained")}</option>
          <option value="fullWidth">{i18n("Full width")}</option>
        </select>
      </div>
    </div>
  );
}
