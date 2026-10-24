"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


/* eslint-disable @next/next/no-img-element */

import { useCallback, useId, useRef, useState } from "react";
import { ImagePlus, UploadCloud, X } from "lucide-react";

import { ACCEPTED_IMAGE_TYPES, uploadImage, type UploadCategory } from "@/features/upload/api";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/components/ui/loading";

type MultiImageUploaderProps = {
  /** VPS directory matching the kind of images being uploaded. */
  category: UploadCategory;
  /** Current list of hosted image URLs. */
  value: string[];
  /** Called with the next list whenever images are added or removed. */
  onChange: (urls: string[]) => void;
  label?: string;
  disabled?: boolean;
  /** Hard cap on stored images. Defaults to 20. */
  max?: number;
  className?: string;
};

/**
 * Gallery uploader for "extra images". Supports multi-select and
 * drag-and-drop; each file is uploaded via `/api/upload` and appended to
 * the list. No URL text inputs — images are managed purely as thumbnails.
 */
export default function MultiImageUploader({
  category,
  value,
  onChange,
  label,
  disabled,
  max = 20,
  className,
}: MultiImageUploaderProps) {
  const i18n = useInterfaceTranslations("InterfaceUiMultiImageUploader");
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);

      const remaining = max - value.length;
      if (remaining <= 0) {
        setError(`You can upload at most ${max} images.`);
        return;
      }

      const selected = Array.from(files).slice(0, remaining);
      setPending((count) => count + selected.length);

      const uploadedUrls: string[] = [];
      for (const file of selected) {
        try {
          const uploaded = await uploadImage(file, category);
          uploadedUrls.push(uploaded.url);
        } catch (uploadError) {
          setError(
            uploadError instanceof Error
              ? uploadError.message
              : "One or more images failed to upload.",
          );
        } finally {
          setPending((count) => Math.max(0, count - 1));
        }
      }

      if (uploadedUrls.length > 0) {
        onChange([...value, ...uploadedUrls]);
      }
      if (inputRef.current) inputRef.current.value = "";
    },
    [category, max, onChange, value],
  );

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    void handleFiles(event.target.files);
  };

  const onDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    void handleFiles(event.dataTransfer.files);
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const isUploading = pending > 0;
  const atCapacity = value.length >= max;

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          {i18n(label)}
        </span>
      )}

      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-brand-border"
            >
              <img
                src={url}
                alt={i18n("Image {value0}", { value0: index + 1 })}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeAt(index)}
                disabled={disabled}
                className="absolute end-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-gray-900/60 text-white opacity-0 transition hover:bg-rose-600 group-hover:opacity-100 disabled:opacity-50"
                aria-label={i18n("Remove image {value0}", { value0: index + 1 })}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!atCapacity && (
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-brand-border bg-brand-light-bg p-3 text-center transition",
            isDragging && "border-brand-red bg-brand-red/5",
            disabled && "cursor-not-allowed opacity-70",
          )}
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-red/10 text-brand-red">
            {isUploading ? (
              <LoadingSpinner decorative size="sm" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
          </span>
          <span className="text-sm font-semibold text-brand-red">
            {isUploading ? i18n("Uploading {value0}...", { value0: pending }) : i18n("Add images")}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-gray-500">
            <UploadCloud className="h-3 w-3" />
            {i18n("select multiple or drag & drop (")}{value.length}/{max})
          </span>

          <input
            id={inputId}
            ref={inputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            multiple
            onChange={onInputChange}
            disabled={disabled}
            className="sr-only"
          />
        </label>
      )}

      {error && <p className="text-xs font-semibold text-rose-600">{i18n(error)}</p>}
    </div>
  );
}
