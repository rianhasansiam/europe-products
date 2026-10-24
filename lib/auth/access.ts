import "server-only";

export function hasUserOrAdminAccess(role: string | undefined): boolean {
  return role === "USER" || role === "ADMIN";
}
