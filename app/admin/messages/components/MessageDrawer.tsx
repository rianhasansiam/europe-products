"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Archive, Inbox, MailOpen, Trash2, X } from "lucide-react";

import {
  formatDateTime,
  type AdminMessageRow,
  type ContactMessageStatus,
} from "@/features/admin-messages/api";
import { cn } from "@/lib/utils";

import MessageActionButton from "./MessageActionButton";
import { STATUS_BADGE } from "./constants";

export default function MessageDrawer({
  message,
  onClose,
  onSetStatus,
  onDelete,
  isBusy,
}: {
  message: AdminMessageRow;
  onClose: () => void;
  onSetStatus: (next: ContactMessageStatus) => void;
  onDelete: () => void;
  isBusy: boolean;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminMessagesComponentsMessageDrawer");
  return (
    <div
      className="fixed inset-0 z-70 flex items-end justify-end bg-gray-900/40 backdrop-blur-sm sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-brand-border bg-brand-light-bg px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-gray-900">
              {message.subject}
            </p>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {message.name} · {message.email}
              {message.phone ? ` · ${message.phone}` : ""}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-brand-text-muted">
              {i18n("Received")}{" "}{formatDateTime(message.createdAt, locale)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={i18n("Close")}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset",
              STATUS_BADGE[message.status],
            )}
          >
            {message.status}
          </span>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
            {message.message}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
          {message.status !== "READ" && (
            <MessageActionButton
              tone="emerald"
              busy={isBusy}
              onClick={() => onSetStatus("READ")}
              icon={<MailOpen className="h-3.5 w-3.5" />}
              label={i18n("Mark as read")}
            />
          )}
          {message.status !== "ARCHIVED" && (
            <MessageActionButton
              tone="amber"
              busy={isBusy}
              onClick={() => onSetStatus("ARCHIVED")}
              icon={<Archive className="h-3.5 w-3.5" />}
              label={i18n("Archive")}
            />
          )}
          {message.status === "ARCHIVED" && (
            <MessageActionButton
              tone="emerald"
              busy={isBusy}
              onClick={() => onSetStatus("NEW")}
              icon={<Inbox className="h-3.5 w-3.5" />}
              label={i18n("Move to inbox")}
            />
          )}
          <MessageActionButton
            tone="red"
            busy={isBusy}
            onClick={onDelete}
            icon={<Trash2 className="h-3.5 w-3.5" />}
            label={i18n("Delete")}
          />
        </div>
      </div>
    </div>
  );
}
