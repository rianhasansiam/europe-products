import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guards";
import { jsonError, ok } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import {
  getProfileOverview,
  updateOwnProfile,
} from "@/lib/services/user.service";
import { handleServiceError } from "@/lib/services/service-error";
import { updateProfileSchema } from "@/lib/validations/user.validation";

/**
 * GET /api/user/me
 *
 * Logged-in users only. Two flavours of payload:
 *   - default: lightweight profile (name, email, phone, city, image,
 *     role) used to prefill the checkout form and the navbar.
 *   - `?include=overview`: the same profile plus aggregate stats
 *     (lifetime spend, order counts grouped by status, cart and
 *     wishlist size). The /profile dashboard uses this so it can
 *     render the overview tab without a second round-trip.
 *
 * The password hash and any secret material is never returned.
 */
export async function GET(request: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const include = request.nextUrl.searchParams.get("include");

  try {
    if (include === "overview") {
      const overview = await getProfileOverview(guard.session.user.id);
      return ok(overview);
    }

    const user = await prisma.user.findUnique({
      where: { id: guard.session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        image: true,
        role: true,
        provider: true,
        createdAt: true,
        updatedAt: true,
        // Pull the saved shipping address (default first, else newest) so
        // the checkout form can prefill street/city/postal/area too. The
        // checkout client reads these optional fields when present.
        addresses: {
          orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
          take: 1,
          select: {
            fullName: true,
            phone: true,
            city: true,
            area: true,
            address: true,
            postalCode: true,
          },
        },
      },
    });
    if (!user) return jsonError(404, "User not found.");

    const { addresses, ...profile } = user;
    const savedAddress = addresses[0] ?? null;

    // Flatten the best saved address into the profile payload. User-level
    // fields (phone/city) win when set; the address backfills what's
    // missing so the checkout form gets the most complete picture.
    return ok({
      ...profile,
      phone: profile.phone ?? savedAddress?.phone ?? null,
      city: profile.city ?? savedAddress?.city ?? null,
      address: savedAddress?.address ?? null,
      area: savedAddress?.area ?? null,
      postalCode: savedAddress?.postalCode ?? null,
    });
  } catch (error) {
    return handleServiceError("user.me.GET", error);
  }
}

/**
 * PATCH /api/user/me
 *
 * Logged-in users only. Partial update of the editable profile fields
 * (name, phone, city, image). Email is intentionally locked because a
 * change there touches auth identity and we don't have a verification
 * flow yet.
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

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please review the highlighted fields and try again.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const user = await updateOwnProfile(guard.session.user.id, parsed.data);
    return ok(user);
  } catch (error) {
    return handleServiceError("user.me.PATCH", error);
  }
}
