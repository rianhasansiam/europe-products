"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Mail, MailOpen, Archive, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import {
  formatDateTime,
  getInitials,
  type AdminMessageRow,
  type ContactMessageStatus,
} from "@/features/admin-messages/api";
import { TableSkeleton } from "@/components/ui/loading";
import {
  LIST_ITEM_TRANSITION,
  LIST_ITEM_VARIANTS,
} from "@/lib/motion/list-removal";
import { cn } from "@/lib/utils";

import MessageActionButton from "./MessageActionButton";
import { STATUS_BADGE } from "./constants";

export default function MessagesTable({
  messages,
  isLoading,
  totalCount,
  busyId,
  onOpen,
  onSetStatus,
  onDelete,
}: {
  messages: AdminMessageRow[];
  isLoading: boolean;
  totalCount: number;
  busyId: string | null;
  onOpen: (row: AdminMessageRow) => void;
  onSetStatus: (row: AdminMessageRow, next: ContactMessageStatus) => void;
  onDelete: (row: AdminMessageRow) => void;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminMessagesComponentsMessagesTable");
  if (isLoading && totalCount === 0) {
    return <TableSkeleton rows={6} columns={5} ariaLabel="Loading messages" />;
  }

  if (messages.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-border bg-brand-white p-10 text-center text-sm text-gray-600 shadow-sm">
        <Mail className="mx-auto mb-2 h-8 w-8 text-brand-text-muted" />
        {i18n("No messages match the current filters.")}</div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-brand-light-bg text-start text-xs uppercase tracking-wider text-foreground">
            <tr>
              <th className="px-4 py-3">{i18n("From")}</th>
              <th className="px-4 py-3">{i18n("Subject")}</th>
              <th className="px-4 py-3">{i18n("Status")}</th>
              <th className="px-4 py-3">{i18n("Received")}</th>
              <th className="px-4 py-3 text-end">{i18n("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
            {messages.map((row) => {
              const isBusy = busyId === row.id;
              const isNew = row.status === "NEW";

              return (
                <motion.tr
                  key={row.id}
                  layout
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={LIST_ITEM_VARIANTS}
                  transition={LIST_ITEM_TRANSITION}
                  className={cn(
                    "border-t border-brand-border align-top transition-colors hover:bg-brand-light-bg",
                    isNew && "bg-brand-red/5",
                  )}
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOpen(row)}
                      className="flex items-center gap-3 text-start"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-black text-xs font-bold text-white">
                        {getInitials(row.name, row.email)}
                      </div>
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "truncate text-gray-900",
                            isNew ? "font-bold" : "font-semibold",
                          )}
                        >
                          {row.name || "—"}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {row.email}
                          {row.phone ? ` · ${row.phone}` : ""}
                        </p>
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOpen(row)}
                      className="block w-full text-start"
                    >
                      <p
                        className={cn(
                          "truncate text-gray-900",
                          isNew ? "font-bold" : "font-medium",
                        )}
                      >
                        {row.subject}
                      </p>
                      <p className="line-clamp-1 text-xs text-gray-500">
                        {row.message}
                      </p>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset",
                        STATUS_BADGE[row.status],
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {formatDateTime(row.createdAt, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {row.status !== "READ" && (
                        <MessageActionButton
                          tone="emerald"
                          busy={isBusy}
                          onClick={() => onSetStatus(row, "READ")}
                          icon={<MailOpen className="h-3.5 w-3.5" />}
                          label={i18n("Read")}
                        />
                      )}
                      {row.status !== "ARCHIVED" && (
                        <MessageActionButton
                          tone="amber"
                          busy={isBusy}
                          onClick={() => onSetStatus(row, "ARCHIVED")}
                          icon={<Archive className="h-3.5 w-3.5" />}
                          label={i18n("Archive")}
                        />
                      )}
                      <MessageActionButton
                        tone="red"
                        busy={isBusy}
                        onClick={() => onDelete(row)}
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        label={i18n("Delete")}
                      />
                    </div>
                  </td>
                </motion.tr>
              );
            })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}
