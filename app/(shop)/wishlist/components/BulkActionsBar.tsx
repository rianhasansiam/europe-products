"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { ShoppingCart, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type BulkActionsBarProps = {
  selectedCount: number;
  onClear: () => void;
  onMoveAllToCart: () => void;
  onRemoveAll: () => void;
};

export default function BulkActionsBar({
  selectedCount,
  onClear,
  onMoveAllToCart,
  onRemoveAll,
}: BulkActionsBarProps) {
  const i18n = useInterfaceTranslations("InterfaceWishlistComponentsBulkActionsBar");
  const visible = selectedCount > 0;

  return (
    <div
      role="region"
      aria-label={i18n("Bulk actions")}
      aria-hidden={!visible}
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-3 transition-all duration-300 ease-out min-[360px]:px-4",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-12 opacity-0",
      )}
    >
      <div className="pointer-events-auto flex w-full max-w-2xl items-center gap-2 rounded-2xl border border-white/10 bg-brand-black/95 px-3 py-3 text-brand-white shadow-2xl backdrop-blur-xl min-[360px]:gap-3 min-[360px]:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-red text-sm font-bold">
            {selectedCount}
          </span>
          <p className="hidden text-sm font-medium min-[360px]:block">
            {selectedCount === 1 ? i18n("item") : i18n("items")} {i18n("selected")}</p>
        </div>

        <div className="ms-auto flex shrink-0 items-center gap-1.5 min-[360px]:gap-2">
          <button
            type="button"
            onClick={onMoveAllToCart}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-red px-2.5 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-red-hover min-[360px]:px-3"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">{i18n("Move to cart")}</span>
            <span className="sm:hidden">{i18n("Cart")}</span>
          </button>
          <button
            type="button"
            onClick={onRemoveAll}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-2.5 py-2 text-sm font-semibold text-rose-200 transition-colors hover:bg-rose-500/30 hover:text-white min-[360px]:px-3"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">{i18n("Remove")}</span>
          </button>
          <button
            type="button"
            onClick={onClear}
            aria-label={i18n("Clear selection")}
            className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 transition-colors hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
