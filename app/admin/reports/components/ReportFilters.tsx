"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { CalendarRange, Hash, Infinity as InfinityIcon, Play } from "lucide-react";

import { ButtonLoader } from "@/components/ui/loading";

type Props = {
  from: string;
  to: string;
  limit: number;
  allTime: boolean;
  isLoading: boolean;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onLimitChange: (value: number) => void;
  onAllTimeChange: (value: boolean) => void;
  onGenerate: () => void;
  onPresetWindow: (days: number) => void;
};

const PRESETS: Array<{ days: number; label: string }> = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

/**
 * Date window + record-cap controls. The "Generate" button kicks off
 * the API call; while it's in flight the inputs stay editable but the
 * button shows a spinner so admins know exactly what's happening.
 */
export default function ReportFilters(props: Props) {
  const i18n = useInterfaceTranslations("AdminAdminReportsComponentsReportFilters");
  return (
    <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={i18n("From")} icon={<CalendarRange className="h-3.5 w-3.5" />}>
          <input
            type="date"
            value={props.from}
            disabled={props.allTime}
            onChange={(event) => props.onFromChange(event.target.value)}
            className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
          />
        </Field>

        <Field label={i18n("To")} icon={<CalendarRange className="h-3.5 w-3.5" />}>
          <input
            type="date"
            value={props.to}
            disabled={props.allTime}
            onChange={(event) => props.onToChange(event.target.value)}
            className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
          />
        </Field>

        <Field
          label={i18n("Records")}
          hint={i18n("Caps detail rows in the report.")}
          icon={<Hash className="h-3.5 w-3.5" />}
        >
          <input
            type="number"
            min={10}
            max={500}
            step={10}
            value={props.limit}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next)) props.onLimitChange(next);
            }}
            className="h-10 w-28 rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
          />
        </Field>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => props.onAllTimeChange(!props.allTime)}
            className={
              "inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-all duration-200 " +
              (props.allTime
                ? "border-brand-red bg-brand-red text-white shadow-sm"
                : "border-brand-border bg-white text-brand-black hover:bg-brand-light-bg")
            }
            aria-pressed={props.allTime}
          >
            <InfinityIcon className="h-4 w-4" />
            {i18n("All time")}</button>

          <div
            className={
              "inline-flex rounded-xl border border-brand-border bg-brand-light-bg p-1 text-xs font-bold transition-opacity " +
              (props.allTime ? "pointer-events-none opacity-40" : "")
            }
          >
            {PRESETS.map((preset) => (
              <button
                key={preset.days}
                type="button"
                onClick={() => props.onPresetWindow(preset.days)}
                className="rounded-lg px-3 py-1.5 text-brand-text-muted transition-all duration-200 hover:bg-white hover:text-brand-red"
              >
                {i18n("Last")}{" "}{preset.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={props.onGenerate}
            disabled={props.isLoading}
            aria-busy={props.isLoading}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-red px-4 text-sm font-semibold text-white transition hover:bg-brand-red-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {props.isLoading ? (
              <ButtonLoader label={i18n("Generating...")} />
            ) : (
              <>
                <Play className="h-4 w-4" />
                {i18n("Generate report")}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  icon,
  children,
}: {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted">
        {icon}
        {label}
      </span>
      {children}
      {hint && <span className="text-[11px] text-gray-500">{hint}</span>}
    </label>
  );
}
