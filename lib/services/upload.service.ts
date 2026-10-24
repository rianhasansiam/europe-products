import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, writeFile, unlink, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { ServiceError } from "@/lib/services/service-error";
import {
  deleteUploadFileViaSSH,
  usesSSHUploadStorage,
  writeUploadFileViaSSH,
} from "@/lib/services/upload-ssh.storage";

/**
 * VPS filesystem upload service.
 *
 * Images are written to a persistent directory outside the Next.js project
 * tree, served by Nginx at a public URL. Environment variables control the
 * base directory and public URL prefix:
 *
 *   UPLOAD_DIR=/var/www/uploads/sextoy
 *   UPLOAD_PUBLIC_URL=https://example.com/uploads
 *   MAX_UPLOAD_SIZE_MB=5
 *
 * The service validates MIME types, generates unique filenames, optimizes
 * images with sharp (WebP, resize), and never trusts the client-provided
 * filename for filesystem paths.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function getUploadDir(): string {
  const dir = process.env.UPLOAD_DIR;
  if (!dir) {
    throw new ServiceError(500, "Image upload storage is not configured.");
  }
  return dir;
}

function getUploadPublicUrl(): string {
  const url = process.env.UPLOAD_PUBLIC_URL;
  if (!url) {
    throw new ServiceError(500, "Image upload public URL is not configured.");
  }
  // Strip trailing slash for consistent URL construction
  return url.replace(/\/+$/, "");
}

function getMaxUploadBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_SIZE_MB);
  if (Number.isFinite(mb) && mb > 0) return mb * 1024 * 1024;
  return 5 * 1024 * 1024; // Default 5 MB
}

export const MAX_UPLOAD_BYTES = getMaxUploadBytes();

export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/avif",
] as const;

/** Upload categories that map to subdirectories. */
export type UploadCategory =
  | "products"
  | "categories"
  | "users"
  | "banners"
  | "other";

const VALID_CATEGORIES = new Set<UploadCategory>([
  "products",
  "categories",
  "users",
  "banners",
  "other",
]);

export type UploadResult = {
  url: string;
  displayUrl: string;
  thumbUrl: string;
  deleteUrl: string;
  width: number;
  height: number;
  size: number;
};

// ---------------------------------------------------------------------------
// Magic-bytes MIME validation
// ---------------------------------------------------------------------------

const MAGIC_BYTES: { mime: string; bytes: number[]; offset?: number }[] = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF
  { mime: "image/bmp", bytes: [0x42, 0x4d] },
  // TIFF: little-endian or big-endian
  { mime: "image/tiff", bytes: [0x49, 0x49, 0x2a, 0x00] },
  { mime: "image/tiff", bytes: [0x4d, 0x4d, 0x00, 0x2a] },
  // AVIF: ftyp box — we check bytes 4-7 for "ftyp"
  { mime: "image/avif", bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
];

function detectMimeFromBytes(buffer: Buffer): string | null {
  for (const entry of MAGIC_BYTES) {
    const offset = entry.offset ?? 0;
    if (buffer.length < offset + entry.bytes.length) continue;

    let match = true;
    for (let i = 0; i < entry.bytes.length; i++) {
      if (buffer[offset + i] !== entry.bytes[i]) {
        match = false;
        break;
      }
    }

    if (match) {
      // RIFF can be WEBP or other formats — verify the "WEBP" marker at offset 8
      if (entry.mime === "image/webp") {
        if (
          buffer.length >= 12 &&
          buffer[8] === 0x57 && // W
          buffer[9] === 0x45 && // E
          buffer[10] === 0x42 && // B
          buffer[11] === 0x50 // P
        ) {
          return "image/webp";
        }
        continue; // RIFF but not WEBP
      }
      return entry.mime;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Filename generation
// ---------------------------------------------------------------------------

function generateUniqueFilename(extension: string): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(12).toString("hex");
  return `${timestamp}-${random}${extension}`;
}

// ---------------------------------------------------------------------------
// Path safety
// ---------------------------------------------------------------------------

/**
 * Resolve the target directory and ensure it's inside the configured
 * upload root. Prevents path-traversal attacks from a `category` value.
 *
 * Turbopack also traces path.join/resolve independently of filesystem reads.
 * These storage paths refer to persistent runtime data outside the release,
 * so their ignore annotations keep project files out of the upload trace.
 */
function safeCategoryDir(category: UploadCategory): string {
  const root = resolve(/* turbopackIgnore: true */ getUploadDir());
  const target = resolve(/* turbopackIgnore: true */ root, category);

  if (!target.startsWith(root + "/") && target !== root) {
    throw new ServiceError(400, "Invalid upload category.");
  }
  return target;
}

/**
 * Returns true when `filePath` is physically inside the configured
 * `UPLOAD_DIR`. Used before unlink operations to prevent deletion of
 * arbitrary files.
 */
export function isInsideUploadDir(filePath: string): boolean {
  try {
    const root = resolve(/* turbopackIgnore: true */ getUploadDir());
    const resolved = resolve(/* turbopackIgnore: true */ filePath);
    return resolved.startsWith(root + "/");
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Image optimization (sharp)
// ---------------------------------------------------------------------------

const MAX_DIMENSION = 2048;

async function optimizeImage(
  buffer: Buffer,
  detectedMime: string,
): Promise<{ data: Buffer; width: number; height: number; size: number }> {
  // Dynamic import so sharp is only loaded when needed.
  // sharp is available via the Next.js override in package.json.
  const sharp = (await import("sharp")).default;

  let pipeline = sharp(buffer, { failOn: "truncated" });

  const metadata = await pipeline.metadata();
  const originalWidth = metadata.width ?? 0;
  const originalHeight = metadata.height ?? 0;

  // Resize if either dimension exceeds the limit, preserving aspect ratio
  if (originalWidth > MAX_DIMENSION || originalHeight > MAX_DIMENSION) {
    pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // GIF and animated images: preserve as-is (sharp doesn't animate well)
  if (detectedMime === "image/gif") {
    const optimized = await pipeline.toBuffer({ resolveWithObject: true });
    return {
      data: optimized.data,
      width: optimized.info.width,
      height: optimized.info.height,
      size: optimized.data.length,
    };
  }

  // Convert to WebP for non-GIF images
  pipeline = pipeline.webp({ quality: 82, effort: 4 });

  const optimized = await pipeline.toBuffer({ resolveWithObject: true });
  return {
    data: optimized.data,
    width: optimized.info.width,
    height: optimized.info.height,
    size: optimized.data.length,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Upload a single image file to the VPS filesystem.
 *
 * @param file     The image provided by the client (multipart form field).
 * @param category Subdirectory for organizational purposes. Defaults to "other".
 */
export async function uploadImageToVPS(
  file: File,
  category: UploadCategory = "other",
): Promise<UploadResult> {
  // Validate category
  if (!VALID_CATEGORIES.has(category)) {
    throw new ServiceError(400, "Invalid upload category.");
  }

  const maxBytes = getMaxUploadBytes();

  if (file.size === 0) {
    throw new ServiceError(400, "The uploaded file is empty.");
  }
  if (file.size > maxBytes) {
    const limitMB = Math.round(maxBytes / (1024 * 1024));
    throw new ServiceError(413, `Image exceeds the ${limitMB}MB upload limit.`);
  }
  if (
    !ALLOWED_IMAGE_MIME.includes(
      file.type as (typeof ALLOWED_IMAGE_MIME)[number],
    )
  ) {
    throw new ServiceError(415, "Only image files can be uploaded.");
  }

  // Read file bytes
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Server-side magic-byte MIME validation
  const detectedMime = detectMimeFromBytes(buffer);
  if (!detectedMime) {
    throw new ServiceError(
      415,
      "The file does not appear to be a valid image.",
    );
  }
  if (
    !ALLOWED_IMAGE_MIME.includes(
      detectedMime as (typeof ALLOWED_IMAGE_MIME)[number],
    )
  ) {
    throw new ServiceError(415, "Unsupported image format.");
  }

  // Verify URL configuration before writing so a configuration error cannot
  // leave an image behind without returning its hosted URL.
  const publicBase = getUploadPublicUrl();

  // Optimize image
  let optimized: {
    data: Buffer;
    width: number;
    height: number;
    size: number;
  };
  try {
    optimized = await optimizeImage(buffer, detectedMime);
  } catch (error) {
    console.error("[upload.service] image optimization failed", error);
    throw new ServiceError(
      422,
      "The image could not be processed. It may be corrupted.",
    );
  }

  // Determine file extension based on the output format
  const extension =
    detectedMime === "image/gif" ? ".gif" : ".webp";

  const filename = generateUniqueFilename(extension);
  const targetDir = safeCategoryDir(category);
  const filePath = join(/* turbopackIgnore: true */ targetDir, filename);

  // Double-check the resolved path is still inside the upload root
  const uploadRoot = resolve(/* turbopackIgnore: true */ getUploadDir());
  if (!resolve(/* turbopackIgnore: true */ filePath).startsWith(uploadRoot + "/")) {
    throw new ServiceError(400, "Invalid upload path.");
  }

  if (usesSSHUploadStorage()) {
    await writeUploadFileViaSSH(uploadRoot, category, filename, optimized.data);
  } else {
    // Ensure the category directory exists on the machine running Next.js.
    try {
      await mkdir(targetDir, { recursive: true });
    } catch (error) {
      console.error("[upload.service] mkdir failed", error);
      throw new ServiceError(
        500,
        "Upload storage is unavailable. Please try again later.",
      );
    }

    try {
      await writeFile(filePath, optimized.data);
    } catch (error) {
      console.error("[upload.service] write failed", error);
      throw new ServiceError(
        500,
        "Failed to save the image. Please try again.",
      );
    }
  }

  // Build the public URL
  const publicUrl = `${publicBase}/${category}/${filename}`;

  return {
    url: publicUrl,
    displayUrl: publicUrl,
    thumbUrl: publicUrl,
    deleteUrl: "", // VPS images are deleted server-side, no external delete URL
    width: optimized.width,
    height: optimized.height,
    size: optimized.size,
  };
}

// ---------------------------------------------------------------------------
// Deletion helpers
// ---------------------------------------------------------------------------

/**
 * Derive the filesystem path from a VPS-hosted public URL.
 * Returns `null` if the URL is not a VPS-hosted image (e.g. ImgBB).
 */
export function resolveUploadPath(url: string): string | null {
  let publicBase: string;
  try {
    publicBase = getUploadPublicUrl();
  } catch {
    return null;
  }

  if (!url.startsWith(`${publicBase}/`)) return null;

  const relativePath = url.slice(publicBase.length).replace(/^\/+/, "");
  if (!relativePath || relativePath.includes("..")) return null;

  const uploadDir = getUploadDir();
  const fullPath = resolve(/* turbopackIgnore: true */ uploadDir, relativePath);

  // Safety: ensure the resolved path is inside the upload directory
  if (!fullPath.startsWith(resolve(/* turbopackIgnore: true */ uploadDir) + "/")) return null;

  return fullPath;
}

/**
 * Safely delete a VPS-hosted image file.
 *
 * - Only deletes files inside the configured UPLOAD_DIR.
 * - Silently ignores files that don't exist (already deleted).
 * - Never attempts to delete ImgBB or other external URLs.
 *
 * @returns true if the file was deleted, false if skipped/not found.
 */
export async function deleteUploadedFile(url: string): Promise<boolean> {
  const filePath = resolveUploadPath(url);
  if (!filePath) return false; // External URL (e.g. ImgBB) — skip

  if (!isInsideUploadDir(filePath)) return false;

  try {
    if (usesSSHUploadStorage()) {
      const root = resolve(/* turbopackIgnore: true */ getUploadDir());
      const parts = relative(root, filePath).split("/");
      if (parts.length !== 2 || !VALID_CATEGORIES.has(parts[0] as UploadCategory)) {
        return false;
      }
      return await deleteUploadFileViaSSH(root, parts[0], parts[1]);
    }
    // UPLOAD_DIR contains persistent runtime files outside the release tree.
    // Tracing this dynamic path would incorrectly package the whole project.
    const fileStat = await stat(/* turbopackIgnore: true */ filePath);
    if (!fileStat.isFile()) return false; // Don't delete directories
    await unlink(filePath);
    return true;
  } catch (error: unknown) {
    // ENOENT = file already gone — not an error
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "ENOENT"
    ) {
      return false;
    }
    console.error("[upload.service] delete failed", filePath, error);
    return false;
  }
}
