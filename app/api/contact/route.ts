import type { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { isAllowedOrigin } from "@/lib/auth/origin";
import { getClientIp, rateLimit } from "@/lib/auth/rate-limit";
import { created, jsonError, tooManyRequests } from "@/lib/api/response";
import { createContactMessage } from "@/lib/services/contact.service";
import { handleServiceError } from "@/lib/services/service-error";
import { contactMessageSchema } from "@/lib/validations/contact.validation";

/**
 * Contact-form rate limit. Keyed per-IP only — keying on email would
 * let an attacker scan emails to bypass the bucket. 5 messages every
 * 10 minutes is plenty for a real shopper, painful for spammers.
 */
const CONTACT_MAX_ATTEMPTS = 5;
const CONTACT_WINDOW_MS = 10 * 60 * 1000;

/**
 * POST /api/contact
 *
 * Public endpoint. Persists the contact-form submission and busts the
 * "admin-messages" cache so the admin Messages page picks up the new
 * row on its next visit.
 */
export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request)) {
    return jsonError(403, "Request blocked.");
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonError(415, "Content-Type must be application/json.");
  }

  const ip = getClientIp(request);
  const limit = rateLimit(
    `contact:${ip}`,
    CONTACT_MAX_ATTEMPTS,
    CONTACT_WINDOW_MS,
  );
  if (!limit.allowed) return tooManyRequests(limit.resetMs);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON payload.");
  }

  const parsed = contactMessageSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please review the highlighted fields and try again.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const message = await createContactMessage(parsed.data);
    revalidateTag("admin-messages", "max");
    return created(message);
  } catch (error) {
    return handleServiceError("contact.POST", error);
  }
}
