"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


/* eslint-disable @next/next/no-img-element */

import { useCallback, useId, useRef, useState } from "react";
import { ImagePlus, Trash2, UploadCloud } from "lucide-react";

import { ACCEPTED_IMAGE_TYPES, uploadImage, type UploadCategory } from "@/features/upload/api";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/components/ui/loading";

type ImageUploaderProps = {
  /** VPS directory matching the kind of image being uploaded. */
  category: UploadCategory;
  /** Current hosted image URL (empty string when none). */
  value: string;
  /** Called with the new hosted URL after a successful upload, or "" on clear. */
  onChange: (url: string) => void;
  /** Optional label shown above the dropzone. */
  label?: string;
  /** Disable interaction (e.g. while a parent form submits). */
  disabled?: boolean;
  className?: string;
};

/**
 * Single image picker that uploads via `/api/upload`.
 *
 * There is intentionally no URL text box — the admin drops or selects a
 * file, we upload it, and the resulting hosted URL is pushed up through
 * `onChange`. The preview reflects whatever URL the parent currently
 * holds so it works for both create (empty) and edit (existing) flows.
 */
export default function ImageUploader({
  category,
  value,
  onChange,
  label,
  disabled,
  className,
}: ImageUploaderProps) {
  const i18n = useInterfaceTranslations("InterfaceUiImageUploader");
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      setError(null);
      setIsUploading(true);
      try {
        const uploaded = await uploadImage(file, category);
        onChange(uploaded.url);
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Image upload failed.",
        );
      } finally {
        setIsUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [category, onChange],
  );

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    void handleFile(event.target.files?.[0]);
  };

  const onDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading) return;
    void handleFile(event.dataTransfer.files?.[0]);
  };

  const clear = () => {
    setError(null);
    onChange("");
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          {i18n(label)}
        </span>
      )}

      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !isUploading) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          "group relative flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-brand-border bg-brand-light-bg p-3 text-center transition",
          isDragging && "border-brand-red bg-brand-red/5",
          (disabled || isUploading) && "cursor-not-allowed opacity-70",
          value && "border-solid",
        )}
      >
        {value ? (
          <>
            <img
              src={value}
              alt={i18n("Upload preview")}
              className="h-36 w-full rounded-lg object-cover"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gray-900/0 transition group-hover:bg-gray-900/40">
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-brand-red opacity-0 transition group-hover:opacity-100">
                {i18n("Click or drop to replace")}</span>
            </div>
          </>
        ) : (
          <>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-red/10 text-brand-red">
              {isUploading ? (
                <LoadingSpinner decorative size="md" />
              ) : (
                <ImagePlus className="h-5 w-5" />
              )}
            </span>
            <span className="text-sm font-semibold text-brand-red">
              {isUploading ? i18n("Uploading...") : i18n("Click to upload")}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-gray-500">
              <UploadCloud className="h-3 w-3" />
              {i18n("or drag & drop an image (max 5MB)")}</span>
          </>
        )}

        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          onChange={onInputChange}
          disabled={disabled || isUploading}
          className="sr-only"
        />
      </label>

      {value && (
        <button
          type="button"
          onClick={clear}
          disabled={disabled || isUploading}
          className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 transition hover:text-rose-700 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {i18n("Remove image")}</button>
      )}

      {isUploading && (
        <p className="flex items-center gap-1 text-xs text-brand-red">
          <LoadingSpinner decorative size="xs" />
          {i18n("Uploading image...")}</p>
      )}

      {error && <p className="text-xs font-semibold text-rose-600">{i18n(error)}</p>}
    </div>
  );
}
