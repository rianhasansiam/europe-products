/**
 * Legacy key used by older checkout builds. Receipt snapshots are no longer
 * written or trusted; the owner-scoped API is the only order-detail source.
 */
const ORDER_SNAPSHOT_STORAGE_KEY = "enterfly:order:last:v1";

export function clearOrderSnapshot() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ORDER_SNAPSHOT_STORAGE_KEY);
  } catch {
    // ignore: private browsing mode can disable sessionStorage writes.
  }
}
