"use client";
import { useLocale } from "next-intl";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import {
  AlertTriangle,
  Check,
  CreditCard,
  MapPin,
  Package,
  PackageCheck,
  RotateCcw,
  ShoppingBag,
  Truck,
  Undo2,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import type { OrderStatusHistoryEntry } from "@/features/orders/api";
import {
  ORDER_STATUS_META,
  ORDER_TRACKING_STEPS,
  trackingStepIndex,
  type OrderStatus,
} from "@/lib/orders/status";
import { cn } from "@/lib/utils";

const STEP_ICONS: Record<(typeof ORDER_TRACKING_STEPS)[number], LucideIcon> = {
  PENDING: ShoppingBag,
  PAYMENT_CONFIRMED: CreditCard,
  SELLER_TO_PACK: Package,
  PACKED: PackageCheck,
  READY_TO_SHIP: Truck,
  WAREHOUSE: Warehouse,
  IN_TRANSIT: Truck,
  OUT_FOR_DELIVERY: MapPin,
  DELIVERED: Check,
};

/** Branch (off-pipeline) statuses get a banner instead of a rail step. */
const BRANCH_STATUSES = new Set<OrderStatus>([
  "CANCELLED",
  "RETURN_REQUESTED",
  "RETURNED",
  "REFUNDED",
]);

type StepState = "done" | "current" | "todo";

function formatStamp(value: string | undefined, locale: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(locale, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OrderTracker({
  status,
  history,
  className,
}: {
  status: OrderStatus;
  history: OrderStatusHistoryEntry[];
  className?: string;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("InterfaceOrdersIdComponentsOrderTracker");
  // `history` can be absent on the first paint when the page renders
  // from a pre-tracking checkout snapshot; treat anything non-array as
  // empty so the rail still renders from `status` alone.
  const entries = Array.isArray(history) ? history : [];

  // Earliest timestamp recorded for each status (history is asc).
  const stampByStatus = new Map<OrderStatus, string>();
  for (const entry of entries) {
    if (!stampByStatus.has(entry.status)) {
      stampByStatus.set(entry.status, entry.createdAt);
    }
  }

  const isBranch = BRANCH_STATUSES.has(status);
  const isCancelled = status === "CANCELLED";
  const currentIndex = trackingStepIndex(status);

  // How far along the linear rail the order has travelled.
  let reachedIndex = currentIndex;
  if (reachedIndex < 0) {
    // Branch state: a return/refund means delivery completed; a
    // cancellation stops wherever the history last landed.
    if (status === "CANCELLED") {
      reachedIndex = ORDER_TRACKING_STEPS.reduce(
        (max, step, i) => (stampByStatus.has(step) ? Math.max(max, i) : max),
        -1,
      );
    } else {
      reachedIndex = ORDER_TRACKING_STEPS.length - 1; // delivered
    }
  }

  const stepState = (index: number): StepState => {
    if (isBranch) return index <= reachedIndex ? "done" : "todo";
    if (index < currentIndex) return "done";
    if (index === currentIndex) return status === "DELIVERED" ? "done" : "current";
    return "todo";
  };

  const branchMeta = isBranch ? ORDER_STATUS_META[status] : null;
  const branchStamp = formatStamp(stampByStatus.get(status), locale);

  const steps = ORDER_TRACKING_STEPS.map((step, index) => ({
    status: step,
    index,
    state: stepState(index),
    label: ORDER_STATUS_META[step].customerLabel,
    description: ORDER_STATUS_META[step].description,
    stamp: formatStamp(stampByStatus.get(step), locale),
    Icon: STEP_ICONS[step],
  }));

  return (
    <section
      className={cn(
        "rounded-3xl border border-brand-border bg-brand-white p-5 shadow-sm sm:p-6",
        className,
      )}
      aria-label={i18n("Order tracking timeline")}
    >
      <header className="mb-5 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-light-bg text-brand-black">
          <Truck className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-gray-900">{i18n("Order tracking")}</h2>
          <p className="text-xs text-gray-500">
            {i18n("Follow your package through every stage.")}</p>
        </div>
      </header>

      {isCancelled ? (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <p className="text-sm font-bold text-rose-700">{i18n("Order cancelled")}</p>
            <p className="text-xs text-rose-600">
              {branchStamp
                ? i18n("Cancelled on {value0}.", { value0: branchStamp })
                : i18n("This order was cancelled and will not be delivered.")}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Vertical timeline — mobile */}
          <ol className="flex flex-col gap-0 md:hidden">
            {steps.map((step, i) => (
              <VerticalStep
                key={step.status}
                step={step}
                isLast={i === steps.length - 1}
              />
            ))}
          </ol>

          {/* Horizontal timeline — desktop */}
          <ol className="hidden items-start md:flex">
            {steps.map((step, i) => (
              <HorizontalStep
                key={step.status}
                step={step}
                isFirst={i === 0}
                isLast={i === steps.length - 1}
                leftDone={i > 0 && steps[i - 1].state === "done"}
                rightDone={step.state === "done"}
              />
            ))}
          </ol>
        </>
      )}

      {/* Return / refund branch banner */}
      {branchMeta && !isCancelled && (
        <div
          className={cn(
            "mt-5 flex items-start gap-3 rounded-2xl p-4 ring-1 ring-inset",
            branchMeta.tone.ring,
          )}
        >
          {status === "REFUNDED" ? (
            <RotateCcw className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <Undo2 className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div>
            <p className="text-sm font-bold">{i18n(branchMeta.label)}</p>
            <p className="text-xs opacity-90">
              {i18n(branchMeta.description)}
              {branchStamp ? ` · ${branchStamp}` : ""}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

type StepView = {
  status: OrderStatus;
  state: StepState;
  label: string;
  description: string;
  stamp: string | null;
  Icon: LucideIcon;
};

function StepDot({ state, Icon }: { state: StepState; Icon: LucideIcon }) {
  return (
    <span
      className={cn(
        "relative grid h-9 w-9 shrink-0 place-items-center rounded-full ring-4 transition-colors",
        state === "done" && "bg-emerald-500 text-white ring-emerald-100",
        state === "current" &&
          "bg-brand-red text-brand-white ring-brand-red/20 animate-pulse",
        state === "todo" && "bg-gray-100 text-gray-400 ring-gray-50",
      )}
    >
      {state === "done" ? (
        <Check className="h-4 w-4" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
    </span>
  );
}

function VerticalStep({ step, isLast }: { step: StepView; isLast: boolean }) {
  const i18n = useInterfaceTranslations("InterfaceOrdersIdComponentsOrderTracker");
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <StepDot state={step.state} Icon={step.Icon} />
        {!isLast && (
          <span
            className={cn(
              "w-0.5 flex-1",
              step.state === "done" ? "bg-emerald-300" : "bg-gray-200",
            )}
          />
        )}
      </div>
      <div className={cn("pb-6", isLast && "pb-0")}>
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "text-sm font-semibold",
              step.state === "todo" ? "text-gray-400" : "text-gray-900",
            )}
          >
            {i18n(step.label)}
          </p>
          {step.state === "current" && (
            <span className="rounded-full bg-brand-red/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-red">
              {i18n("Current")}</span>
          )}
        </div>
        {step.stamp ? (
          <p className="mt-0.5 text-xs text-gray-500">{step.stamp}</p>
        ) : (
          <p className="mt-0.5 text-xs text-gray-400">{i18n(step.description)}</p>
        )}
      </div>
    </li>
  );
}

function HorizontalStep({
  step,
  isFirst,
  isLast,
  leftDone,
  rightDone,
}: {
  step: StepView;
  isFirst: boolean;
  isLast: boolean;
  leftDone: boolean;
  rightDone: boolean;
}) {
  const i18n = useInterfaceTranslations("InterfaceOrdersIdComponentsOrderTracker");
  return (
    <li className="flex flex-1 flex-col items-center text-center">
      <div className="flex w-full items-center">
        <span
          className={cn(
            "h-0.5 flex-1",
            isFirst ? "invisible" : leftDone ? "bg-emerald-300" : "bg-gray-200",
          )}
        />
        <StepDot state={step.state} Icon={step.Icon} />
        <span
          className={cn(
            "h-0.5 flex-1",
            isLast ? "invisible" : rightDone ? "bg-emerald-300" : "bg-gray-200",
          )}
        />
      </div>
      <div className="mt-2 px-1">
        <p
          className={cn(
            "text-xs font-semibold leading-tight",
            step.state === "todo" ? "text-gray-400" : "text-gray-900",
          )}
        >
          {i18n(step.label)}
        </p>
        {step.state === "current" && (
          <span className="mt-1 inline-block rounded-full bg-brand-red/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-red">
            {i18n("Current")}</span>
        )}
        {step.stamp && (
          <p className="mt-0.5 text-[10px] text-gray-500">{step.stamp}</p>
        )}
      </div>
    </li>
  );
}
