import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guards";
import { jsonError, ok } from "@/lib/api/response";
import { changeOwnPassword } from "@/lib/services/user.service";
import { handleServiceError } from "@/lib/services/service-error";
import { changePasswordSchema } from "@/lib/validations/user.validation";

/**
 * PATCH /api/user/me/password
 *
 * Logged-in users only. Changes (or first-time sets) the password on
 * the caller's account. The service enforces:
 *   - credential accounts must supply the current password,
 *   - Google-only accounts can set a password for the first time
 *     without one (mirroring the "set a password" flows of similar
 *     OAuth-first products).
 *
 * The new password is bcrypt-hashed before it touches the database.
 */
export async function PATCH(request: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonError(415, "Content-Type must be application/json.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON payload.");
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please review the highlighted fields and try again.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const result = await changeOwnPassword(guard.session.user.id, parsed.data);
    return ok(result);
  } catch (error) {
    return handleServiceError("user.me.password.PATCH", error);
  }
}
