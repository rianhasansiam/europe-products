"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Archive, Inbox, MailOpen } from "lucide-react";

import { cn } from "@/lib/utils";

type SummaryAccent = "violet" | "emerald" | "amber";

const ACCENT_STYLES: Record<SummaryAccent, string> = {
  violet: "bg-brand-light-bg text-brand-black",
  emerald: "bg-brand-light-bg text-brand-black",
  amber: "bg-brand-light-bg text-brand-black",
};

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: SummaryAccent;
}) {
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-white p-4 shadow-sm">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          "mt-2 inline-flex rounded-xl px-3 py-1.5 text-sm font-bold",
          ACCENT_STYLES[accent],
        )}
      >
        {value}
      </p>
    </div>
  );
}

export default function MessageSummaryCards({
  newCount,
  readCount,
  archivedCount,
}: {
  newCount: number;
  readCount: number;
  archivedCount: number;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminMessagesComponentsMessageSummaryCards");
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryCard
        icon={<Inbox className="h-4 w-4" />}
        label={i18n("New")}
        value={newCount.toLocaleString(locale)}
        accent="violet"
      />
      <SummaryCard
        icon={<MailOpen className="h-4 w-4" />}
        label={i18n("Read")}
        value={readCount.toLocaleString(locale)}
        accent="emerald"
      />
      <SummaryCard
        icon={<Archive className="h-4 w-4" />}
        label={i18n("Archived")}
        value={archivedCount.toLocaleString(locale)}
        accent="amber"
      />
    </div>
  );
}
