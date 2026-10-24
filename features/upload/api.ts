import { readApiData } from "@/features/http/api-envelope";

/**
 * Client helper for the `/api/upload` route.
 *
 * The browser only ever talks to our own endpoint — all storage logic
 * stays on the server. Components send a `File` and get back the hosted
 * URL to store in their form state.
 */

export type UploadedImage = {
  url: string;
  displayUrl: string;
  thumbUrl: string;
  deleteUrl: string;
  width: number;
  height: number;
  size: number;
};

/** Default upload size limit (5 MB). Must match server-side MAX_UPLOAD_SIZE_MB. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES =
  "image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif";

/**
 * Upload categories that map to server-side subdirectories.
 * The server validates this value; invalid values fall back to "other".
 */
export type UploadCategory =
  | "products"
  | "categories"
  | "users"
  | "banners"
  | "other";

/**
 * Upload a single image file and resolve with its hosted URLs.
 *
 * @param file     The image file to upload.
 * @param category Optional subdirectory category (e.g. "products").
 */
export async function uploadImage(
  file: File,
  category?: UploadCategory,
): Promise<UploadedImage> {
  const body = new FormData();
  body.append("image", file);
  if (category) {
    body.append("category", category);
  }

  const response = await fetch("/api/upload", {
    method: "POST",
    body,
    cache: "no-store",
  });

  return readApiData<UploadedImage>(response, "Image upload failed.");
}
