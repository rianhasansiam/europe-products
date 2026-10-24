"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";
import { useLocale } from "next-intl";


import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Inbox,
  ReceiptText,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

import { LoadingSpinner, TableSkeleton } from "@/components/ui/loading";
import {
  fetchAdminTransactions,
  formatTransactionAmount,
  formatTransactionDate,
  getTransactionStatusMeta,
  paymentProviderLabel,
  TRANSACTION_STATUS_META,
  TRANSACTION_STATUS_VALUES,
  type AdminTransaction,
  type TransactionPageMeta,
  type TransactionStatus,
} from "@/features/transactions/api";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const inputClass =
  "h-10 rounded-xl border border-brand-border bg-white px-3 text-sm outline-none transition focus:border-brand-red";

const PROVIDER_OPTIONS = [
  { value: "SSLCOMMERZ", label: "SSLCommerz" },
  { value: "AIRWALLEX", label: "Airwallex" },
  { value: "ADMIN_ADVANCE", label: "Admin advance" },
  { value: "CASH_ON_DELIVERY", label: "Cash on delivery" },
  { value: "ONLINE", label: "Legacy online payment" },
] as const;

type ReviewFilter = "" | "OPEN" | "RESOLVED";

export default function TransactionsClient() {
  const i18n = useInterfaceTranslations("AdminAdminTransactionsTransactionsClient");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<TransactionStatus | "">("");
  const [provider, setProvider] = useState("");
  const [review, setReview] = useState<ReviewFilter>("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [items, setItems] = useState<AdminTransaction[]>([]);
  const [meta, setMeta] = useState<TransactionPageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      setItems([]);
      setMeta(null);
      try {
        const result = await fetchAdminTransactions({
          page,
          pageSize: PAGE_SIZE,
          search: debouncedSearch || undefined,
          status: status || undefined,
          provider: provider || undefined,
          review: review || undefined,
        });
        if (signal.aborted) return;
        setItems(result.items);
        setMeta(result.meta);
        if (result.meta.page !== page) setPage(result.meta.page);
      } catch (loadError) {
        if (signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load transaction history.",
        );
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [debouncedSearch, page, provider, review, status],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void load(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, refreshKey]);

  const updateStatus = (value: TransactionStatus | "") => {
    setStatus(value);
    setPage(1);
  };
  const updateProvider = (value: string) => {
    setProvider(value);
    setPage(1);
  };
  const updateReview = (value: ReviewFilter) => {
    setReview(value);
    setPage(1);
  };

  const hasFilters = Boolean(search || status || provider || review);
  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("");
    setProvider("");
    setReview("");
    setPage(1);
  };

  const range = useMemo(() => {
    const total = meta?.total ?? 0;
    if (total === 0) return { start: 0, end: 0 };
    const visiblePage = meta?.page ?? 1;
    return {
      start: (visiblePage - 1) * PAGE_SIZE + 1,
      end: Math.min(visiblePage * PAGE_SIZE, total),
    };
  }, [meta?.page, meta?.total]);

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-extrabold text-gray-900 sm:text-xl">
            <ReceiptText className="h-5 w-5 text-brand-red" />
            {i18n("Transaction history")}</h1>
          <p className="text-xs text-gray-500">
            {i18n("Every recorded payment record across customer and guest orders.")}</p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loading}
          aria-busy={loading}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-brand-border bg-white px-3 text-xs font-bold text-brand-red shadow-sm transition hover:-translate-y-0.5 hover:border-brand-red hover:bg-brand-light-bg disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {loading ? (
            <LoadingSpinner decorative size="sm" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
          {loading ? i18n("Refreshing...") : i18n("Refresh")}
        </button>
      </header>

      <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_180px_190px_170px_auto]">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={i18n("Search transaction, order, or customer...")}
            aria-label={i18n("Search transactions")}
            className={inputClass}
          />
          <select
            value={status}
            onChange={(event) =>
              updateStatus(event.target.value as TransactionStatus | "")
            }
            aria-label={i18n("Filter by transaction status")}
            className={inputClass}
          >
            <option value="">{i18n("All statuses")}</option>
            {TRANSACTION_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {TRANSACTION_STATUS_META[value].label}
              </option>
            ))}
          </select>
          <select
            value={provider}
            onChange={(event) => updateProvider(event.target.value)}
            aria-label={i18n("Filter by provider")}
            className={inputClass}
          >
            <option value="">{i18n("All providers")}</option>
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {i18n(option.label)}
              </option>
            ))}
          </select>
          <select
            value={review}
            onChange={(event) =>
              updateReview(event.target.value as ReviewFilter)
            }
            aria-label={i18n("Filter by review state")}
            className={inputClass}
          >
            <option value="">{i18n("All review states")}</option>
            <option value="OPEN">{i18n("Open review")}</option>
            <option value="RESOLVED">{i18n("Resolved review")}</option>
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-brand-border px-3 text-sm font-semibold text-gray-700 transition hover:bg-brand-light-bg"
            >
              <RotateCcw className="h-4 w-4" />
              {i18n("Reset")}</button>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">{i18n("Couldn't load transactions.")}</p>
            <p className="text-xs">{i18n(error)}</p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
          >
            {i18n("Try again")}</button>
        </div>
      )}

      {!error &&
        (loading ? (
          <TableSkeleton
            rows={8}
            columns={6}
            ariaLabel="Loading transaction history"
          />
        ) : (
          <TransactionTable items={items} />
        ))}

      {!error && meta && meta.total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-gray-500">
            {i18n("Showing")}{" "}<span className="font-semibold">{range.start}</span>-
            <span className="font-semibold">{range.end}</span> {i18n("of")}{" "}
            <span className="font-semibold">{meta.total}</span> {i18n("transactions")}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, meta.page - 1))}
              disabled={meta.page <= 1 || loading}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-brand-border bg-white px-3 text-xs font-bold text-gray-700 transition hover:bg-brand-light-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              {i18n("Previous")}</button>
            <span className="text-xs font-semibold text-gray-600">
              {i18n("Page")}{" "}{meta.page} {i18n("of")}{" "}{meta.totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setPage(Math.min(meta.totalPages, meta.page + 1))
              }
              disabled={meta.page >= meta.totalPages || loading}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-brand-border bg-white px-3 text-xs font-bold text-gray-700 transition hover:bg-brand-light-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {i18n("Next")}<ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function TransactionTable({ items }: { items: AdminTransaction[] }) {
  const i18n = useInterfaceTranslations("AdminAdminTransactionsTransactionsClient");
  if (items.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-brand-border bg-white px-4 py-16 text-center shadow-sm">
        <Inbox className="h-8 w-8 text-brand-text-muted" />
        <p className="mt-2 text-sm font-semibold text-gray-700">
          {i18n("No transactions found")}</p>
        <p className="mt-1 text-xs text-gray-500">
          {i18n("Recorded payment attempts will appear here.")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm">
      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full text-start text-sm">
          <thead className="border-b border-brand-border bg-brand-light-bg/60 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-semibold">{i18n("Transaction")}</th>
              <th className="px-4 py-3 font-semibold">{i18n("Order & customer")}</th>
              <th className="px-4 py-3 font-semibold">{i18n("Provider")}</th>
              <th className="px-4 py-3 font-semibold">{i18n("Status")}</th>
              <th className="px-4 py-3 text-end font-semibold">{i18n("Amount")}</th>
              <th className="px-4 py-3 text-end font-semibold">{i18n("Date")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {items.map((transaction) => (
              <TransactionDesktopRow
                key={transaction.id}
                transaction={transaction}
              />
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-brand-border lg:hidden">
        {items.map((transaction) => (
          <TransactionMobileCard
            key={transaction.id}
            transaction={transaction}
          />
        ))}
      </ul>
    </div>
  );
}

function TransactionDesktopRow({
  transaction,
}: {
  transaction: AdminTransaction;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminTransactionsTransactionsClient");
  const reference = transaction.transactionId ?? transaction.id;
  const completion = transactionCompletion(transaction);

  return (
    <tr className="align-top transition hover:bg-brand-light-bg/40">
      <td className="max-w-64 px-4 py-3">
        <p className="truncate font-mono text-xs font-bold text-gray-800" title={reference}>
          {reference}
        </p>
        {transaction.bankTransactionId && (
          <p
            className="mt-1 truncate font-mono text-[11px] text-gray-500"
            title={transaction.bankTransactionId}
          >
            {i18n("Bank:")}{" "}{transaction.bankTransactionId}
          </p>
        )}
      </td>
      <td className="px-4 py-3">
        <p className="font-bold text-gray-900">
          #{transaction.order.orderNumber}
        </p>
        <p className="mt-0.5 text-xs font-medium text-gray-700">
          {transaction.order.user?.name || transaction.order.customerName}
        </p>
        <p className="text-[11px] text-gray-500">
          {transaction.order.user?.email ||
            transaction.order.customerEmail ||
            transaction.order.customerPhone}
        </p>
      </td>
      <td className="px-4 py-3">
        <p className="font-semibold text-gray-800">
          {paymentProviderLabel(transaction.provider)}
        </p>
        <p className="text-xs text-gray-500">
          {transaction.cardType || "No card type"}
        </p>
      </td>
      <td className="px-4 py-3">
        <TransactionState transaction={transaction} />
      </td>
      <td className="px-4 py-3 text-end font-extrabold text-gray-900">
        {formatTransactionAmount(transaction.amount, transaction.currency, locale)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-end text-xs text-gray-500">
        {formatTransactionDate(transaction.createdAt, locale)}
        {completion && (
          <p className="mt-1 text-emerald-700">
            {completion.label} {formatTransactionDate(completion.value, locale)}
          </p>
        )}
      </td>
    </tr>
  );
}

function TransactionMobileCard({
  transaction,
}: {
  transaction: AdminTransaction;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminTransactionsTransactionsClient");
  const reference = transaction.transactionId ?? transaction.id;
  const completion = transactionCompletion(transaction);
  const customerContact =
    transaction.order.user?.email ||
    transaction.order.customerEmail ||
    transaction.order.customerPhone;

  return (
    <li className="p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-light-bg text-brand-red">
          <CreditCard className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="break-all font-mono text-xs font-bold text-gray-800">
                {reference}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                #{transaction.order.orderNumber} ·{" "}
                {transaction.order.user?.name ||
                  transaction.order.customerName}
              </p>
              <p className="mt-0.5 break-all text-[11px] text-gray-500">
                {customerContact}
              </p>
            </div>
            <p className="text-sm font-extrabold text-brand-red">
              {formatTransactionAmount(
                transaction.amount,
                transaction.currency,
                locale,
              )}
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TransactionState transaction={transaction} />
          </div>
          <p className="mt-2 text-xs text-gray-600">
            {paymentProviderLabel(transaction.provider)}
            {transaction.cardType ? ` · ${transaction.cardType}` : ""}
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            {formatTransactionDate(transaction.createdAt, locale)}
          </p>
          {completion && (
            <p className="mt-1 text-[11px] font-medium text-emerald-700">
              {completion.label} {formatTransactionDate(completion.value, locale)}
            </p>
          )}
          {transaction.bankTransactionId && (
            <p className="mt-2 break-all rounded-lg bg-brand-light-bg px-2 py-1.5 font-mono text-[10px] text-gray-600">
              {i18n("Bank:")}{" "}{transaction.bankTransactionId}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function TransactionState({
  transaction,
}: {
  transaction: AdminTransaction;
}) {
  const i18n = useInterfaceTranslations("AdminAdminTransactionsTransactionsClient");
  const status = getTransactionStatusMeta(transaction.status);
  const reviewCode = transaction.requiresReview
    ? transaction.reviewReason || "Review required"
    : transaction.reviewResolvedAt
      ? transaction.reviewResolution || "Review resolved"
      : null;
  const reviewDetail = reviewCode ? paymentReviewLabel(reviewCode) : null;

  return (
    <div className="space-y-1.5">
      <span
        className={cn(
          "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset",
          status.pill,
        )}
      >
        {status.label}
      </span>
      {reviewDetail && (
        <p
          className={cn(
            "flex max-w-64 items-start gap-1 text-[11px] font-semibold",
            transaction.requiresReview ? "text-amber-700" : "text-gray-500",
          )}
          title={[
            reviewCode,
            transaction.reviewResolutionReference,
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="min-w-0 break-words">
            {reviewDetail}
            {transaction.reviewResolutionReference
              ? " · "
              : ""}
            {transaction.reviewResolutionReference && (
              <span className="break-all">
                {transaction.reviewResolutionReference}
              </span>
            )}
          </span>
        </p>
      )}
      {transaction.riskLevel != null && (
        <p className="text-[10px] text-gray-500">
          {i18n("Risk level")}{" "}{transaction.riskLevel}
        </p>
      )}
    </div>
  );
}

function transactionCompletion(transaction: AdminTransaction): {
  label: "Paid" | "Recorded";
  value: string;
} | null {
  if (transaction.paidAt) {
    return { label: "Paid", value: transaction.paidAt };
  }
  if (transaction.status === "SUCCESS") {
    return { label: "Recorded", value: transaction.createdAt };
  }
  return null;
}

function paymentReviewLabel(value: string): string {
  const labels: Record<string, string> = {
    RISK_REVIEW: "Provider risk review",
    MISSING_RISK_LEVEL: "Risk level verification",
    PAYMENT_MISMATCH: "Payment details mismatch",
    DISTINCT_VALIDATED_PAYMENT_AFTER_REFUND:
      "New validated charge after refund",
    REFUND_CONFIRMED: "Refund confirmed",
    APPROVED: "Approved",
    REFUND_AND_CANCEL: "Refunded and cancelled",
  };
  if (labels[value]) return labels[value];

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (character) => character.toUpperCase());
}
