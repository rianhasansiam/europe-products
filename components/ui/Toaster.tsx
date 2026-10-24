"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


/**
 * Toaster — lightweight toast notification system.
 *
 * Usage (from anywhere, including server-action callbacks):
 *   import { toast } from "@/lib/feedback";
 *   toast.success("Added to cart");
 *   toast.error("Something went wrong");
 *   toast.info("Copied to clipboard");
 *   toast.warning("Only 2 left in stock");
 */

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { usePathname } from "@/lib/i18n/navigation";

import { cn } from "@/lib/utils";
import { toastEmitter, type ToastItem } from "@/lib/feedback";

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
} as const;

const STYLES = {
  success: "bg-emerald-50 border-emerald-200 text-emerald-800",
  error: "bg-rose-50 border-rose-200 text-rose-800",
  info: "bg-brand-red/5 border-brand-red/20 text-brand-red",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
} as const;

const ICON_STYLES = {
  success: "text-emerald-500",
  error: "text-rose-500",
  info: "text-brand-red",
  warning: "text-amber-500",
} as const;

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const i18n = useInterfaceTranslations("InterfaceUiToaster");
  const Icon = ICONS[item.type];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(item.id), item.duration ?? 3500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [item.id, item.duration, onDismiss]);

  return (
    <div
      className={cn(
        "flex w-full min-w-0 max-w-sm animate-in items-start gap-3 rounded-2xl border px-3 py-3 shadow-lg fade-in slide-in-from-bottom-4 duration-300 motion-reduce:animate-none sm:px-4",
        STYLES[item.type],
      )}
      role="alert"
      aria-live="polite"
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", ICON_STYLES[item.type])} />
      <p className="min-w-0 flex-1 text-sm font-medium leading-snug [overflow-wrap:anywhere]">
        {item.message}
      </p>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label={i18n("Dismiss notification")}
        className="shrink-0 rounded-lg p-0.5 opacity-60 transition-opacity hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function Toaster() {
  const i18n = useInterfaceTranslations("InterfaceUiToaster");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const pathname = usePathname();
  const hasMobileBottomActions =
    pathname === "/cart" ||
    pathname === "/wishlist" ||
    (pathname?.startsWith("/products/") ?? false);

  useEffect(() => {
    const unsub = toastEmitter.subscribe((item) => {
      setToasts((prev) => {
        // Deduplicate: if the same message is already visible, skip it.
        if (prev.some((t) => t.message === item.message && t.type === item.type)) {
          return prev;
        }
        return [...prev, item];
      });
    });
    return unsub;
  }, []);

  const dismiss = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div
      role="region"
      aria-label={i18n("Notifications")}
      className={cn(
        "pointer-events-none fixed inset-x-3 z-9999 flex min-w-0 flex-col items-stretch gap-2 sm:start-auto sm:end-6 sm:w-full sm:max-w-sm lg:bottom-6",
        hasMobileBottomActions
          ? "bottom-[calc(5.75rem+env(safe-area-inset-bottom))]"
          : "bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto w-full min-w-0 max-w-sm">
          <ToastCard item={t} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  );
}
