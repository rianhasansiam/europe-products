import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/api/guards";
import { jsonError, ok } from "@/lib/api/response";
import { revalidateCacheTags } from "@/lib/cache/revalidation";
import { logAdminActivity } from "@/lib/services/admin-activity.service";
import { updateUserRole } from "@/lib/services/user.service";
import { handleServiceError } from "@/lib/services/service-error";
import { updateUserRoleSchema } from "@/lib/validations/user.validation";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/users/[id]/role
 *
 * Admin only. Flip a user between USER and ADMIN. The service refuses
 * to demote the last remaining ADMIN so the panel can't lock itself
 * out, and skips no-op writes.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;

  // Stop admins from demoting themselves out of the panel.
  if (id === guard.session.user.id) {
    return jsonError(409, "You can't change your own role.");
  }

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

  const parsed = updateUserRoleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please review the highlighted fields and try again.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const user = await updateUserRole(id, parsed.data);
    await logAdminActivity({
      kind: "user",
      action: "updated",
      target: user.name || user.email || "customer role",
      targetId: user.id,
      href: "/admin/users",
      actor: guard.session.user,
    });
    revalidateCacheTags(["admin-users"]);
    return ok(user);
  } catch (error) {
    return handleServiceError("admin.users/[id].role.PATCH", error);
  }
}
