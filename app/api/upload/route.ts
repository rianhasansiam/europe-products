import type { NextRequest } from "next/server";

import { requireUser } from "@/lib/api/guards";
import { ok, jsonError, tooManyRequests } from "@/lib/api/response";
import { getClientIp, rateLimit } from "@/lib/auth/rate-limit";
import {
  handleServiceError,
} from "@/lib/services/service-error";
import {
  MAX_UPLOAD_BYTES,
  uploadImageToVPS,
  type UploadCategory,
} from "@/lib/services/upload.service";

const VALID_CATEGORIES = new Set([
  "products",
  "categories",
  "users",
  "banners",
  "other",
]);

/**
 * POST /api/upload
 *
 * Accepts a `multipart/form-data` body with a single `image` file field
 * and stores it on the VPS filesystem. Returns the public URL inside the
 * standard `{ success, data }` envelope.
 *
 * An optional `category` form field selects the subdirectory
 * (products | categories | users | banners | other). Defaults to "other".
 *
 * Auth-gated to logged-in users. Per-IP rate limit as a second line of
 * defence.
 */
export async function POST(request: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const ip = getClientIp(request);
  const limit = rateLimit(`upload:${ip}`, 30, 60_000);
  if (!limit.allowed) {
    return tooManyRequests(limit.resetMs);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return jsonError(415, "Content-Type must be multipart/form-data.");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError(400, "Invalid form data payload.");
  }

  const file = formData.get("image");
  if (!(file instanceof File)) {
    return jsonError(400, "An image file is required.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const limitMB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
    return jsonError(413, `Image exceeds the ${limitMB}MB upload limit.`);
  }

  // Optional category for subdirectory organization
  const rawCategory = formData.get("category");
  let category: UploadCategory = "other";
  if (typeof rawCategory === "string" && VALID_CATEGORIES.has(rawCategory)) {
    category = rawCategory as UploadCategory;
  }

  try {
    const result = await uploadImageToVPS(file, category);
    return ok(result);
  } catch (error) {
    return handleServiceError("upload.POST", error);
  }
}
