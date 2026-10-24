import type { ContactMessageStatus } from "@/features/admin-messages/api";

export const STATUS_BADGE: Record<ContactMessageStatus, string> = {
  NEW: "bg-brand-red/10 text-brand-red ring-brand-red/30",
  READ: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ARCHIVED: "bg-brand-light-bg text-brand-text-muted ring-brand-border",
};
