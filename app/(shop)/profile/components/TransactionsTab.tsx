"use client";
import { useLocale } from "next-intl";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import Link from "@/lib/i18n/navigation";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";

import { TableSkeleton } from "@/components/ui/loading";
import {
  fetchMyTransactions,
  formatTransactionAmount,
  formatTransactionDate,
  getTransactionStatusMeta,
  paymentProviderLabel,
  TRANSACTION_STATUS_META,
  TRANSACTION_STATUS_VALUES,
  type CustomerTransaction,
  type TransactionPageMeta,
  type TransactionStatus,
} from "@/features/transactions/api";

const PAGE_SIZE = 8;

type LoadState =
  | { status: "loading" }
  | {
      status: "ready";
      items: CustomerTransaction[];
      meta: TransactionPageMeta;
    }
  | { status: "error"; message: string };

const STATUS_FILTERS: ReadonlyArray<{
  id: TransactionStatus | "ALL";
  label: string;
}> = [
  { id: "ALL", label: "All" },
  ...TRANSACTION_STATUS_VALUES.map((status) => ({
    id: status,
    label: TRANSACTION_STATUS_META[status].label,
  })),
];

export default function TransactionsTab() {
  const i18n = useInterfaceTranslations("InterfaceProfileComponentsTransactionsTab");
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | "ALL">(
    "ALL",
  );
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let ignore = false;

    void (async () => {
      await Promise.resolve();
      if (ignore) return;
      setState({ status: "loading" });

      try {
        const result = await fetchMyTransactions({
          page,
          pageSize: PAGE_SIZE,
          status: statusFilter === "ALL" ? undefined : statusFilter,
        });
        if (!ignore) {
          setState({
            status: "ready",
            items: result.items,
            meta: result.meta,
          });
          if (result.meta.page !== page) setPage(result.meta.page);
        }
      } catch (error) {
        if (!ignore) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Failed to load your transaction history.",
          });
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [page, refreshKey, statusFilter]);

  const changeStatus = (status: TransactionStatus | "ALL") => {
    setStatusFilter(status);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <header className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-background text-foreground">
              <ReceiptText className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground sm:text-lg">
                {i18n("Payment transactions")}</h2>
              <p className="text-xs text-muted-foreground">
                {i18n("Payment attempts recorded for orders on this account.")}</p>
            </div>
          </div>
          {state.status === "ready" && (
            <p className="text-xs font-medium text-muted-foreground">
              {state.meta.total}{" "}
              {state.meta.total === 1 ? i18n("transaction") : i18n("transactions")} {i18n("total")}</p>
          )}
        </div>

        <div className="-mx-1 mt-4 flex snap-x gap-2 overflow-x-auto px-1 pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
          {STATUS_FILTERS.map((filter) => {
            const active = filter.id === statusFilter;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => changeStatus(filter.id)}
                aria-pressed={active}
                className={
                  active
                    ? "inline-flex shrink-0 snap-start rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm"
                    : "inline-flex shrink-0 snap-start rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground transition hover:border-primary hover:text-primary"
                }
              >
                {i18n(filter.label)}
              </button>
            );
          })}
        </div>
      </header>

      {state.status === "loading" && (
        <TableSkeleton
          rows={5}
          columns={4}
          ariaLabel={i18n("Loading payment transactions")}
        />
      )}

      {state.status === "error" && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p>{i18n(state.message)}</p>
            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              className="mt-2 rounded-lg border border-rose-200 bg-card px-2.5 py-1 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
            >
              {i18n("Try again")}</button>
          </div>
        </div>
      )}

      {state.status === "ready" && state.items.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:rounded-3xl sm:p-10">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-background text-foreground">
            <ReceiptText className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-foreground">
            {i18n("No transactions found")}</h3>
          <p className="mt-1 text-sm text-body">
            {statusFilter === "ALL"
              ? i18n("Your recorded payment attempts will appear here.")
              : i18n("There are no {value0} transactions.", { value0: i18n(TRANSACTION_STATUS_META[statusFilter].label) })}
          </p>
        </div>
      )}

      {state.status === "ready" && state.items.length > 0 && (
        <ul className="space-y-3">
          {state.items.map((transaction) => (
            <TransactionCard key={transaction.id} transaction={transaction} />
          ))}
        </ul>
      )}

      {state.status === "ready" && state.meta.totalPages > 1 && (
        <TransactionPagination
          page={state.meta.page}
          totalPages={state.meta.totalPages}
          onChange={setPage}
        />
      )}
    </div>
  );
}

function TransactionCard({
  transaction,
}: {
  transaction: CustomerTransaction;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("InterfaceProfileComponentsTransactionsTab");
  const status = getTransactionStatusMeta(transaction.status);
  const reference = transaction.transactionId ?? transaction.id;
  const completion = transaction.paidAt
    ? { label: i18n("Paid"), value: transaction.paidAt }
    : transaction.status === "SUCCESS"
      ? { label: i18n("Recorded"), value: transaction.createdAt }
      : null;

  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:rounded-3xl">
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-background text-primary">
              <CreditCard className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${status.pill}`}
                >
                  {i18n(status.label)}
                </span>
                {transaction.requiresReview && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800 ring-1 ring-inset ring-amber-200">
                    <ShieldCheck className="h-3 w-3" />
                    {i18n("Verification pending")}</span>
                )}
              </div>
              <p
                className="mt-2 break-all font-mono text-xs font-semibold text-body"
                title={reference}
              >
                {reference}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {paymentProviderLabel(transaction.provider)}
                {transaction.cardType ? ` · ${transaction.cardType}` : ""}
              </p>
            </div>
          </div>

          <p className="text-start text-lg font-bold text-primary sm:text-end">
            {formatTransactionAmount(
              transaction.amount,
              transaction.currency,
              locale,
            )}
          </p>
        </div>

        <div className="grid gap-3 border-t border-border pt-3 text-xs sm:grid-cols-3">
          <div>
            <p className="font-semibold uppercase tracking-wide text-muted-foreground">
              {i18n("Order")}</p>
            <Link
              href={`/orders/${transaction.order.id}`}
              className="mt-1 inline-flex font-bold text-primary hover:underline"
            >
              #{transaction.order.orderNumber}
            </Link>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wide text-muted-foreground">
              {i18n("Initiated")}</p>
            <p className="mt-1 font-medium text-body">
              {formatTransactionDate(transaction.createdAt, locale)}
            </p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wide text-muted-foreground">
              {completion?.label ?? i18n("Paid")}
            </p>
            <p className="mt-1 font-medium text-body">
              {formatTransactionDate(completion?.value ?? null, locale)}
            </p>
          </div>
        </div>

        {transaction.bankTransactionId && (
          <p className="break-all rounded-xl bg-background px-3 py-2 font-mono text-[11px] text-body">
            {i18n("Bank reference:")}{transaction.bankTransactionId}
          </p>
        )}
      </div>
    </li>
  );
}

function TransactionPagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (next: number) => void;
}) {
  const i18n = useInterfaceTranslations("InterfaceProfileComponentsTransactionsTab");
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-2xl border border-border bg-card p-2.5 text-xs font-semibold text-body shadow-sm sm:p-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        aria-label={i18n("Previous transaction page")}
        className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
        <span className="hidden min-[380px]:inline">{i18n("Previous")}</span>
      </button>
      <span className="text-center">
        {i18n("Page {current, number} of {total, number}", { current: page, total: totalPages })}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        aria-label={i18n("Next transaction page")}
        className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="hidden min-[380px]:inline">{i18n("Next")}</span>
        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
      </button>
    </div>
  );
}
