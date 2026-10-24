"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { RotateCcw, Search } from "lucide-react";

import { LoadingSpinner } from "@/components/ui/loading";
import {
  ROLE_VALUES,
  type CustomerTypeFilter,
  type Role,
} from "@/features/admin-users/api";

type RoleFilter = "ALL" | Role;

export default function UsersToolbar({
  query,
  roleFilter,
  customerTypeFilter,
  visibleCount,
  totalCount,
  isLoading,
  onQueryChange,
  onRoleChange,
  onCustomerTypeChange,
  onRefresh,
}: {
  query: string;
  roleFilter: RoleFilter;
  customerTypeFilter: CustomerTypeFilter;
  visibleCount: number;
  totalCount: number;
  isLoading: boolean;
  onQueryChange: (value: string) => void;
  onRoleChange: (value: RoleFilter) => void;
  onCustomerTypeChange: (value: CustomerTypeFilter) => void;
  onRefresh: () => void;
}) {
  const i18n = useInterfaceTranslations("AdminAdminUsersComponentsUsersToolbar");
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex flex-1 items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-brand-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              aria-label={i18n("Search customers")}
              placeholder={i18n("Search by name, email, phone, city, or address...")}
              className="h-10 w-full rounded-xl border border-brand-border ps-9 pe-3 text-sm outline-none transition focus:border-brand-red"
            />
          </label>

          <select
            aria-label={i18n("Customer type")}
            value={customerTypeFilter}
            onChange={(event) =>
              onCustomerTypeChange(event.target.value as CustomerTypeFilter)
            }
            className="h-10 rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
          >
            <option value="ALL">{i18n("All customers")}</option>
            <option value="REGISTERED">{i18n("Registered")}</option>
            <option value="GUEST">{i18n("Guests")}</option>
          </select>

          <select
            aria-label={i18n("Account role")}
            value={roleFilter}
            disabled={customerTypeFilter === "GUEST"}
            onChange={(event) => onRoleChange(event.target.value as RoleFilter)}
            className="h-10 rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red disabled:opacity-60"
          >
            <option value="ALL">{i18n("All roles")}</option>
            {ROLE_VALUES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          aria-busy={isLoading}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand-border px-3 text-sm font-semibold text-brand-black transition hover:bg-brand-light-bg"
        >
          {isLoading ? (
            <LoadingSpinner decorative size="sm" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          {isLoading ? i18n("Refreshing...") : i18n("Refresh")}
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>
          {visibleCount} / {totalCount} {i18n("customers")}</span>
        {isLoading && (
          <span className="inline-flex items-center gap-1.5">
            <LoadingSpinner decorative size="xs" />
            {i18n("Syncing customers...")}</span>
        )}
      </div>
    </div>
  );
}
