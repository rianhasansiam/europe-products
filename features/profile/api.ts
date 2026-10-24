import { readApiData } from "@/features/http/api-envelope";
import type { OrderStatus } from "@/lib/orders/status";

/**
 * Client-side types and fetchers for the customer "My Profile" page.
 *
 * Mirrors the payloads returned by `/api/user/me` and friends. Kept
 * in its own feature module so the profile UI can import without
 * pulling in admin-user code paths.
 */

export type ProfileRole = "USER" | "ADMIN";
export type ProfileProvider = "CREDENTIAL" | "GOOGLE";

export type ProfileUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  image: string | null;
  role: ProfileRole;
  provider: ProfileProvider;
  termsAcceptedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProfileStats = {
  totalSpend: number;
  totalOrders: number;
  lastOrderAt: string | null;
  ordersByStatus: Partial<Record<OrderStatus, number>>;
  cartCount: number;
  wishlistCount: number;
};

export type ProfileOverview = {
  user: ProfileUser;
  stats: ProfileStats;
};

export async function fetchProfileOverview(): Promise<ProfileOverview> {
  const response = await fetch("/api/user/me?include=overview", {
    method: "GET",
    cache: "no-store",
  });
  return readApiData<ProfileOverview>(response, "Failed to load profile.");
}

export type ProfilePatch = {
  name?: string;
  phone?: string;
  city?: string;
  image?: string;
};

export async function updateProfileOnServer(
  patch: ProfilePatch,
): Promise<ProfileUser> {
  const response = await fetch("/api/user/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  return readApiData<ProfileUser>(response, "Failed to update profile.");
}

export type ChangePasswordPayload = {
  currentPassword?: string;
  newPassword: string;
  confirmPassword: string;
};

export async function changePasswordOnServer(
  payload: ChangePasswordPayload,
): Promise<{ ok: true; hadPassword: boolean }> {
  const response = await fetch("/api/user/me/password", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  return readApiData<{ ok: true; hadPassword: boolean }>(
    response,
    "Failed to change password.",
  );
}
