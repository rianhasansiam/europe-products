"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useEffect, useRef, useState } from "react";
import Link from "@/lib/i18n/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { readApiData } from "@/features/http/api-envelope";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth/use-app-session";
import { fetchOrderDetail } from "@/features/orders/api";
import { trackPendingOrderPurchase } from "@/lib/analytics/order-purchase-browser";

const POLL_INTERVAL_MS = 2_500;
const POLL_TIMEOUT_MS = 60_000;

const PAYMENT_STATUSES = [
  "CREATED",
  "REQUIRES_PAYMENT_METHOD",
  "PENDING",
  "PENDING_REVIEW",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
  "REQUIRES_REVIEW",
] as const;

export type AirwallexPublicPaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type AirwallexPaymentStatusSnapshot = {
  orderId: string;
  paymentStatus: AirwallexPublicPaymentStatus;
  provider: "AIRWALLEX";
  requiresReview: boolean;
  failureMessage: string | null;
  updatedAt: string;
  terminal: boolean;
};

type LoadState =
  | { status: "loading" }
  | { status: "ready"; snapshot: AirwallexPaymentStatusSnapshot }
  | { status: "error"; message: string };

type AirwallexPaymentStatusProps = {
  orderId: string | null;
  autoPoll?: boolean;
  showOrderLink?: boolean;
  embedded?: boolean;
  className?: string;
  onSettled?: () => void;
};

function parseSnapshot(value: unknown): AirwallexPaymentStatusSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.orderId !== "string" ||
    record.provider !== "AIRWALLEX" ||
    !PAYMENT_STATUSES.includes(
      record.paymentStatus as AirwallexPublicPaymentStatus,
    ) ||
    typeof record.requiresReview !== "boolean" ||
    (record.failureMessage !== null &&
      typeof record.failureMessage !== "string") ||
    typeof record.updatedAt !== "string" ||
    typeof record.terminal !== "boolean"
  ) {
    return null;
  }
  return record as AirwallexPaymentStatusSnapshot;
}

async function fetchAirwallexPaymentStatus(
  orderId: string,
  signal: AbortSignal,
): Promise<AirwallexPaymentStatusSnapshot> {
  const response = await fetch(
    `/api/payments/airwallex/status/${encodeURIComponent(orderId)}`,
    { method: "GET", cache: "no-store", signal },
  );
  const data = await readApiData<unknown>(
    response,
    "We couldn't confirm the latest payment status.",
  );
  const snapshot = parseSnapshot(data);
  if (!snapshot) {
    throw new Error("We couldn't confirm the latest payment status.");
  }
  return snapshot;
}

function statusPresentation(
  state: LoadState,
  timedOut: boolean,
): {
  title: string;
  description: string;
  tone: string;
  icon: React.ReactNode;
} {
  if (state.status === "loading") {
    return {
      title: "Confirming your payment",
      description:
        "SexToy is checking its secure server records. You can keep this page open.",
      tone: "border-sky-200 bg-sky-50 text-sky-900",
      icon: <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden="true" />,
    };
  }
  if (state.status === "error") {
    return {
      title: "Payment status is temporarily unavailable",
      description: state.message,
      tone: "border-rose-200 bg-rose-50 text-rose-900",
      icon: <AlertCircle className="h-6 w-6" aria-hidden="true" />,
    };
  }

  const { snapshot } = state;
  if (
    snapshot.requiresReview ||
    snapshot.paymentStatus === "REQUIRES_REVIEW" ||
    snapshot.paymentStatus === "PENDING_REVIEW"
  ) {
    return {
      title:
        snapshot.paymentStatus === "PENDING_REVIEW"
          ? "Payment review is pending"
          : "Payment needs review",
      description:
        "Your order is safely on hold while SexToy reviews the provider confirmation.",
      tone: "border-amber-200 bg-amber-50 text-amber-900",
      icon: <AlertCircle className="h-6 w-6" aria-hidden="true" />,
    };
  }
  if (snapshot.paymentStatus === "SUCCEEDED") {
    return {
      title: "Payment confirmed",
      description:
        "SexToy verified the payment with secure server-side provider data.",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
      icon: <CheckCircle2 className="h-6 w-6" aria-hidden="true" />,
    };
  }
  if (snapshot.paymentStatus === "REFUNDED") {
    return {
      title: "Payment refunded",
      description: "The verified payment record for this order is refunded.",
      tone: "border-slate-200 bg-slate-50 text-slate-900",
      icon: <CheckCircle2 className="h-6 w-6" aria-hidden="true" />,
    };
  }
  if (
    snapshot.paymentStatus === "FAILED" ||
    snapshot.paymentStatus === "CANCELLED"
  ) {
    return {
      title:
        snapshot.paymentStatus === "CANCELLED"
          ? "Payment was cancelled"
          : "Payment was not completed",
      description:
        snapshot.failureMessage ||
        "No payment was confirmed. Open the order details to try again when available.",
      tone: "border-rose-200 bg-rose-50 text-rose-900",
      icon: <AlertCircle className="h-6 w-6" aria-hidden="true" />,
    };
  }
  if (timedOut) {
    return {
      title: "Confirmation is taking longer than expected",
      description:
        "Your order remains safe. Refresh manually or check the order again shortly.",
      tone: "border-sky-200 bg-sky-50 text-sky-900",
      icon: <Clock3 className="h-6 w-6" aria-hidden="true" />,
    };
  }
  return {
    title: "Confirming your payment",
    description:
      snapshot.paymentStatus === "REQUIRES_PAYMENT_METHOD"
        ? "Payment has not been completed yet. You can return to the order to continue securely."
        : "SexToy is waiting for secure server confirmation from Airwallex. This page updates automatically.",
    tone: "border-sky-200 bg-sky-50 text-sky-900",
    icon: <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden="true" />,
  };
}

export function AirwallexPaymentStatus({
  orderId,
  autoPoll = true,
  showOrderLink = true,
  embedded = false,
  className,
  onSettled,
}: AirwallexPaymentStatusProps) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("InterfaceAirwallexComponentsAirwallexPaymentStatus");
  const { data: session } = useSession();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [refreshToken, setRefreshToken] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const settledNotificationRef = useRef<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    let stopped = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    const startedAt = Date.now();

    const poll = async () => {
      if (stopped) return;
      controller = new AbortController();
      try {
        const snapshot = await fetchAirwallexPaymentStatus(
          orderId,
          controller.signal,
        );
        if (stopped) return;
        setState({ status: "ready", snapshot });

        if (snapshot.paymentStatus === "SUCCEEDED" && !snapshot.requiresReview) {
          // The owner-scoped status starts this read, but only the order API's
          // verified commerce snapshot can produce a Purchase. Keep the read
          // independent of payment polling, presentation, and its callbacks.
          void fetchOrderDetail(orderId)
            .then((order) => {
              if (!stopped) trackPendingOrderPurchase(order, session?.user?.id);
            })
            .catch(() => {});
        }

        const settled =
          snapshot.terminal ||
          snapshot.requiresReview ||
          snapshot.paymentStatus === "REQUIRES_REVIEW" ||
          snapshot.paymentStatus === "PENDING_REVIEW";
        if (settled) {
          const notificationKey = `${snapshot.paymentStatus}:${snapshot.updatedAt}`;
          if (settledNotificationRef.current !== notificationKey) {
            settledNotificationRef.current = notificationKey;
            onSettled?.();
          }
          return;
        }
      } catch (error) {
        if (stopped || controller.signal.aborted) return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "We couldn't confirm the latest payment status.",
        });
      }

      if (!autoPoll || stopped) return;
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        setTimedOut(true);
        return;
      }
      timer = window.setTimeout(() => {
        void poll();
      }, POLL_INTERVAL_MS);
    };

    void poll();
    return () => {
      stopped = true;
      controller?.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [autoPoll, onSettled, orderId, refreshToken, session?.user?.id]);

  if (!orderId) {
    return (
      <main className="min-h-screen bg-brand-light-bg px-4 py-16">
        <section className="mx-auto max-w-xl rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto h-10 w-10 text-rose-700" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-extrabold text-gray-900">
            {i18n("Payment return link is incomplete")}</h1>
          <p className="mt-2 text-sm text-gray-600">
            {i18n("Open your order history to review the server-confirmed payment status.")}</p>
          <Button asChild className="mt-6 h-11 px-5">
            <Link href="/profile">{i18n("View your orders")}</Link>
          </Button>
        </section>
      </main>
    );
  }

  const presentation = statusPresentation(state, timedOut);
  const isRefreshing = state.status === "loading";

  const statusCard = (
    <section
      className={cn(
        "rounded-3xl border p-6 shadow-sm sm:p-8",
        embedded ? "w-full" : "mx-auto max-w-2xl",
        presentation.tone,
      )}
      aria-live="polite"
      aria-busy={isRefreshing}
    >
        <div className="flex items-start gap-4">
          <span className="mt-0.5 shrink-0">{presentation.icon}</span>
          <div className="min-w-0 flex-1">
            {embedded ? (
              <h2 className="text-xl font-extrabold tracking-tight">
                {i18n(presentation.title)}
              </h2>
            ) : (
              <h1 className="text-2xl font-extrabold tracking-tight">
                {i18n(presentation.title)}
              </h1>
            )}
            <p className="mt-2 text-sm leading-6">{i18n(presentation.description)}</p>
            {state.status === "ready" ? (
              <p className="mt-3 text-xs font-medium opacity-75">
                {i18n("Last checked")}{new Date(state.snapshot.updatedAt).toLocaleString(locale)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="h-11 px-4"
            onClick={() => {
              setTimedOut(false);
              setState({ status: "loading" });
              setRefreshToken((value) => value + 1);
            }}
            loading={isRefreshing}
            loadingText="Checking..."
          >
            <RefreshCw aria-hidden="true" />
            {i18n("Refresh status")}</Button>
          {showOrderLink ? (
            <Button asChild className="h-11 px-4">
              <Link href={`/orders/${encodeURIComponent(orderId)}`}>
                {i18n("View order details")}</Link>
            </Button>
          ) : null}
        </div>
    </section>
  );

  if (embedded) {
    return <div className={className}>{statusCard}</div>;
  }

  return (
    <main className={cn("min-h-screen bg-brand-light-bg px-4 py-12", className)}>
      {statusCard}
    </main>
  );
}
