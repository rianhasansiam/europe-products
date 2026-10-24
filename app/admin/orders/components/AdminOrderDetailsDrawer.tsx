"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

import {
  fetchAdminOrderDetail,
  type AdminOrderDetail,
  type AdminOrderRow,
} from "@/features/admin-orders/api";
import { LoadingSpinner } from "@/components/ui/loading";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import AdminOrderDetails from "./AdminOrderDetails";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; order: AdminOrderDetail; revision: string }
  | { status: "error"; message: string; revision: string };

export default function AdminOrderDetailsDrawer({
  order,
  onClose,
}: {
  order: AdminOrderRow;
  onClose: () => void;
}) {
  const i18n = useInterfaceTranslations("AdminAdminOrdersComponentsAdminOrderDetailsDrawer");
  const [loadState, setState] = useState<LoadState>({ status: "loading" });
  const state: LoadState =
    loadState.status === "loading" || loadState.revision === order.updatedAt
      ? loadState
      : { status: "loading" };
  const [attempt, setAttempt] = useState(0);
  const [returnFocusTo] = useState(() =>
    typeof document === "undefined" ? null : document.activeElement,
  );

  useEffect(() => {
    const controller = new AbortController();

    void fetchAdminOrderDetail(order.id, controller.signal)
      .then((details) => {
        if (!controller.signal.aborted) {
          setState({ status: "ready", order: details, revision: order.updatedAt });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          revision: order.updatedAt,
          message: error instanceof Error ? error.message : "Failed to load order details.",
        });
      });

    return () => controller.abort();
  }, [order.id, order.updatedAt, attempt]);

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        hideClose
        className="w-full max-w-2xl gap-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (returnFocusTo instanceof HTMLElement) returnFocusTo.focus();
        }}
      >
        <SheetHeader className="relative border-b border-brand-border bg-brand-light-bg px-5 py-4 pe-14">
          <SheetTitle>{i18n("Order details")}</SheetTitle>
          <SheetDescription className="break-all">{order.orderNumber}</SheetDescription>
          <SheetClose aria-label={i18n("Close order details")} className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-500 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-brand-red">
            <X aria-hidden="true" className="h-5 w-5" />
          </SheetClose>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-5 py-5" aria-busy={state.status === "loading"}>
          {state.status === "loading" && (
            <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-gray-500">
              <LoadingSpinner label={i18n("Loading order details")} />
              <span>{i18n("Loading order details...")}</span>
            </div>
          )}
          {state.status === "error" && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p>{state.message}</p>
              <button
                type="button"
                onClick={() => {
                  setState({ status: "loading" });
                  setAttempt((current) => current + 1);
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 font-semibold transition hover:bg-red-100"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                {i18n("Try again")}</button>
            </div>
          )}
          {state.status === "ready" && <AdminOrderDetails order={state.order} />}
        </div>

        <SheetFooter>
          <SheetClose className="rounded-xl border border-brand-border px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-brand-light-bg">{i18n("Close")}</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
