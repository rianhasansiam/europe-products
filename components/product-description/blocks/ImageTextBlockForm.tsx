"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { cn } from "@/lib/utils";
import type { ImageTextBlock } from "@/lib/types/product-description-blocks";
import ImageUploader from "@/components/ui/ImageUploader";
import BlockCommonControls from "@/components/product-description/BlockCommonControls";

const inputClass =
  "h-10 w-full rounded-xl border border-brand-border bg-white px-3 text-sm outline-none transition focus:border-brand-red disabled:cursor-not-allowed disabled:bg-gray-50";

const textareaClass =
  "w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-red disabled:cursor-not-allowed disabled:bg-gray-50 resize-none";

type Props = {
  block: ImageTextBlock;
  onChange: (updated: ImageTextBlock) => void;
  disabled?: boolean;
};

export default function ImageTextBlockForm({ block, onChange, disabled }: Props) {
  const i18n = useInterfaceTranslations("InterfaceProductDescriptionBlocksImageTextBlockForm");
  const patch = (fields: Partial<ImageTextBlock>) =>
    onChange({ ...block, ...fields });

  return (
    <div className="space-y-4">
      {/* Heading */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          {i18n("Heading (optional)")}</label>
        <input
          type="text"
          value={block.heading ?? ""}
          onChange={(e) => patch({ heading: e.target.value || undefined })}
          placeholder={i18n("Section heading…")}
          maxLength={200}
          disabled={disabled}
          className={cn(inputClass)}
        />
      </div>

      {/* Description */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          {i18n("Description (optional)")}</label>
        <textarea
          rows={3}
          value={block.description ?? ""}
          onChange={(e) => patch({ description: e.target.value || undefined })}
          placeholder={i18n("Supporting paragraph text…")}
          maxLength={2000}
          disabled={disabled}
          className={cn(textareaClass)}
        />
      </div>

      {/* Image upload — uses the /api/upload pipeline.
           Only persists the hosted URL, never base64 or blob URLs. */}
      <div>
        <ImageUploader
          category="products"
          label={i18n("Image *")}
          value={block.imageUrl}
          onChange={(url) => patch({ imageUrl: url })}
          disabled={disabled}
        />
        {!block.imageUrl && (
          <p className="mt-1 text-xs text-gray-500">
            {i18n("Upload an image first, then add alt text.")}</p>
        )}
      </div>

      {/* Alt text */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          {i18n("Image alt text *")}</label>
        <input
          type="text"
          value={block.imageAlt}
          onChange={(e) => patch({ imageAlt: e.target.value })}
          placeholder={i18n("Describe the image for screen readers…")}
          maxLength={250}
          disabled={disabled}
          className={cn(inputClass)}
        />
        {block.imageUrl && !block.imageAlt.trim() && (
          <p className="mt-1 text-xs font-semibold text-red-500">
            {i18n("Alt text is required when an image is set.")}</p>
        )}
      </div>

      {/* Image position */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {i18n("Image position")}</p>
        <div className="flex gap-2">
          {(["left", "right"] as const).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => patch({ imagePosition: pos })}
              disabled={disabled}
              className={cn(
                "h-9 flex-1 rounded-xl border text-sm font-semibold capitalize transition",
                block.imagePosition === pos
                  ? "border-brand-red bg-brand-red text-white"
                  : "border-brand-border text-gray-700 hover:border-brand-red hover:text-brand-red",
              )}
            >
              {i18n("Image")}{pos}
            </button>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            {i18n("CTA label (optional)")}</label>
          <input
            type="text"
            value={block.ctaLabel ?? ""}
            onChange={(e) =>
              patch({ ctaLabel: e.target.value || undefined })
            }
            placeholder={i18n("e.g. Shop Now")}
            maxLength={80}
            disabled={disabled}
            className={cn(inputClass)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            {i18n("CTA URL (optional)")}</label>
          <input
            type="url"
            value={block.ctaUrl ?? ""}
            onChange={(e) =>
              patch({ ctaUrl: e.target.value || undefined })
            }
            placeholder="https://…"
            maxLength={2048}
            disabled={disabled}
            className={cn(inputClass)}
          />
        </div>
      </div>

      <BlockCommonControls
        block={block}
        onChange={(fields) => patch(fields)}
        disabled={disabled}
      />
    </div>
  );
}
