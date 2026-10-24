"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


/* eslint-disable @next/next/no-img-element */

import { ShieldCheck, Users } from "lucide-react";

import {
  formatCurrency,
  formatDate,
  getInitials,
  type AdminCustomerRow,
  type Role,
} from "@/features/admin-users/api";
import { LoadingSpinner, TableSkeleton } from "@/components/ui/loading";
import { cn } from "@/lib/utils";

const ROLE_BADGE: Record<Role, string> = {
  USER: "bg-brand-light-bg text-brand-black ring-brand-border",
  ADMIN: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export default function UsersTable({
  users,
  isLoading,
  totalCount,
  busyUserId,
  currentUserId,
  onToggleRole,
}: {
  users: AdminCustomerRow[];
  isLoading: boolean;
  totalCount: number;
  busyUserId: string | null;
  currentUserId: string | null;
  onToggleRole: (user: AdminCustomerRow) => void;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminUsersComponentsUsersTable");
  if (isLoading && totalCount === 0) {
    return <TableSkeleton rows={6} columns={7} ariaLabel="Loading customers" />;
  }

  if (users.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-border bg-brand-white p-10 text-center text-sm text-gray-600 shadow-sm">
        <Users className="mx-auto mb-2 h-8 w-8 text-brand-text-muted" />
        {i18n("No customers match the current filters.")}</div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-brand-light-bg text-start text-xs uppercase tracking-wider text-brand-text-muted">
            <tr>
              <th className="px-4 py-3">{i18n("Customer")}</th>
              <th className="px-4 py-3">{i18n("Contact")}</th>
              <th className="px-4 py-3">{i18n("Type / Role")}</th>
              <th className="px-4 py-3">{i18n("Orders")}</th>
              <th className="px-4 py-3">{i18n("Spend")}</th>
              <th className="px-4 py-3">{i18n("Added")}</th>
              <th className="px-4 py-3 text-end">{i18n("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isGuest = user.customerType === "GUEST";
              const isBusy = !isGuest && busyUserId === user.id;
              const isSelf = !isGuest && user.id === currentUserId;
              const nextRole: Role = user.role === "ADMIN" ? "USER" : "ADMIN";

              return (
                <tr
                  key={`${user.customerType}:${user.id}`}
                  className="border-t border-brand-border align-top"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt={user.name}
                          className="h-10 w-10 rounded-full border border-brand-border object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-black text-xs font-bold text-brand-white">
                          {getInitials(user.name, user.email)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900">
                          {user.name || "—"}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {user.city || "No city set"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="truncate text-gray-700">
                      {user.email || "No email provided"}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {user.phone || "No phone"}
                    </p>
                    {user.customerType === "GUEST" && (
                      <p className="mt-1 max-w-xs whitespace-normal text-xs text-gray-500">
                        {user.address}
                        {user.postalCode ? ` · ${user.postalCode}` : ""}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset",
                        user.customerType === "GUEST"
                          ? "bg-amber-50 text-amber-700 ring-amber-200"
                          : ROLE_BADGE[user.role],
                      )}
                    >
                      {user.customerType === "GUEST" ? i18n("Guest") : user.role}
                    </span>
                    {isSelf && (
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-brand-text-muted">
                        {i18n("You")}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <p className="font-semibold text-gray-900">
                      {user.ordersCount}
                    </p>
                    {user.liveOrdersCount > 0 && (
                      <p className="text-xs text-gray-500">
                        {user.liveOrdersCount} {i18n("active")}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(user.totalSpend, locale)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {i18n("Last:")}{" "}{formatDate(user.lastOrderAt, locale)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {formatDate(user.createdAt, locale)}
                  </td>
                  <td className="px-4 py-3">
                    {user.customerType === "GUEST" ? (
                      <p className="text-end text-xs text-gray-500">{i18n("Guest checkout")}</p>
                    ) : (
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => onToggleRole(user)}
                          disabled={isBusy || isSelf}
                          aria-busy={isBusy}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                            user.role === "ADMIN"
                              ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
                          )}
                        >
                          {isBusy ? (
                            <LoadingSpinner decorative size="sm" />
                          ) : (
                            <ShieldCheck className="h-3.5 w-3.5" />
                          )}
                          {i18n("Make")}{" "}{nextRole}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
