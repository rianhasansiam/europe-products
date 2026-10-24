/**
 * feedback.ts — Centralised action feedback helpers.
 *
 * ─── Toast (small actions) ────────────────────────────────────────────────
 *   import { toast } from "@/lib/feedback";
 *
 *   toast.success("Added to cart");
 *   toast.error("Failed to remove item");
 *   toast.info("Link copied to clipboard");
 *   toast.warning("Only 2 items left in stock");
 *
 * ─── Confirm dialog (major / destructive actions) ─────────────────────────
 *   import { confirm } from "@/lib/feedback";
 *
 *   const ok = await confirm({
 *     title: "Remove item?",
 *     description: "This will remove the item from your cart.",
 *     confirmLabel: "Remove",
 *     variant: "danger",          // "danger" | "warning" | "success" | "info"
 *   });
 *   if (ok) { ... }
 *
 * Both helpers are safe to call from any client component — they communicate
 * with the <Toaster /> and <ConfirmDialog /> mounted in app/providers.tsx via
 * a tiny pub/sub emitter (no React context, no global state library needed).
 */

// ─── Types ────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  /** Auto-dismiss after this many ms. Defaults to 3 500. */
  duration?: number;
}

export type ConfirmVariant = "danger" | "warning" | "success" | "info";

export interface ConfirmRequest {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  resolve?: (value: boolean) => void;
}

// ─── Minimal pub/sub emitter ──────────────────────────────────────────────

function createEmitter<T>() {
  const listeners = new Set<(value: T) => void>();
  return {
    subscribe(fn: (value: T) => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    emit(value: T) {
      listeners.forEach((fn) => fn(value));
    },
  };
}

export const toastEmitter = createEmitter<ToastItem>();
export const confirmEmitter = createEmitter<ConfirmRequest>();

// ─── ID generator ─────────────────────────────────────────────────────────

let _seq = 0;
function uid() {
  return `fb-${Date.now()}-${++_seq}`;
}

// ─── toast helper ─────────────────────────────────────────────────────────

function show(type: ToastType, message: string, duration?: number) {
  toastEmitter.emit({ id: uid(), type, message, duration });
}

export const toast = {
  success: (message: string, duration?: number) =>
    show("success", message, duration),
  error: (message: string, duration?: number) =>
    show("error", message, duration),
  info: (message: string, duration?: number) =>
    show("info", message, duration),
  warning: (message: string, duration?: number) =>
    show("warning", message, duration),
};

// ─── confirm helper ───────────────────────────────────────────────────────

/**
 * Opens a SweetAlert-style confirmation modal and resolves to `true` when
 * the user clicks the confirm button, or `false` when they cancel / dismiss.
 */
export function confirm(options: Omit<ConfirmRequest, "resolve">): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    confirmEmitter.emit({ ...options, resolve });
  });
}
