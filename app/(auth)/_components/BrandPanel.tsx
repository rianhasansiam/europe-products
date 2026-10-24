"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";





import { MapPin, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Perk = {
  icon: LucideIcon;
  title: string;
  body: string;
};

type Stat = {
  value: string;
  label: string;
};

type BrandPanelProps = {
  /** Top-line eyebrow next to the pin badge, e.g. `SexToy · Sign in`. */
  badgeText: string;
  /** Headline shown in white. */
  headlineLead: string;
  /** Headline shown in the gold gradient on the line below. */
  headlineEmphasis: string;
  /** Sub-headline body copy. */
  subheading: string;
  perks: readonly Perk[];
  stats: readonly Stat[];
  activePerkIndex: number;
  onSelectPerk: (index: number) => void;
};

export default function BrandPanel({
  badgeText,
  headlineLead,
  headlineEmphasis,
  subheading,
  perks,
  stats,
  activePerkIndex,
  onSelectPerk,
}: BrandPanelProps) {
  const i18n = useInterfaceTranslations("InterfaceComponentsBrandPanel");
  return (
    <aside className="relative hidden lg:col-span-5 lg:block">
      <div className="sticky top-24 overflow-hidden rounded-3xl bg-brand-black p-8 text-brand-white shadow-2xl ring-1 ring-white/15">
        <div className="pointer-events-none absolute -end-16 -top-16 h-56 w-56 animate-[float_8s_ease-in-out_infinite] rounded-full bg-brand-red/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 -start-16 h-72 w-72 animate-[float_11s_ease-in-out_infinite_reverse] rounded-full bg-brand-white/10 blur-3xl" />
        <div className="pointer-events-none absolute end-10 top-1/3 h-24 w-24 animate-[float_6s_ease-in-out_infinite] rounded-full bg-white/15 blur-xl" />

        <div className="relative z-10 flex h-full flex-col">
          <BrandBadge text={i18n(badgeText)} />

          <h1 className="mt-6 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
            {i18n(headlineLead)}
            <span className="block text-brand-red drop-shadow">
              {i18n(headlineEmphasis)}
            </span>
          </h1>

          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/85">
            {i18n(subheading)}
          </p>

          <RotatingPerks perks={perks} activeIndex={activePerkIndex} />

          <PerkIndicators
            total={perks.length}
            activeIndex={activePerkIndex}
            onSelect={onSelectPerk}
          />

          <BrandStats stats={stats} />
        </div>
      </div>
    </aside>
  );
}

function BrandBadge({ text }: { text: string }) {
  const i18n = useInterfaceTranslations("InterfaceComponentsBrandPanel");
  return (
    <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur-sm ring-1 ring-white/20">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-white text-brand-red">
        <MapPin className="h-3.5 w-3.5" />
      </div>

      <span className="text-[11px] font-bold uppercase tracking-wide">
        {i18n(text)}
      </span>
    </div>
  );
}

function RotatingPerks({
  perks,
  activeIndex,
}: {
  perks: readonly Perk[];
  activeIndex: number;
}) {
  const i18n = useInterfaceTranslations("InterfaceComponentsBrandPanel");
  return (
    <div className="relative mt-8 h-40">
      {perks.map((perk, index) => {
        const Icon = perk.icon;
        const isActive = index === activeIndex;

        return (
          <div
            key={perk.title}
            className={cn(
              "absolute inset-0 rounded-2xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur-md transition-all duration-700 ease-out",
              isActive
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-4 opacity-0",
            )}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-white text-brand-red shadow-md">
                <Icon className="h-5 w-5" />
              </div>

              <div>
                <p className="text-base font-bold">{i18n(perk.title)}</p>
                <p className="mt-1 text-sm text-white/85">{i18n(perk.body)}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PerkIndicators({
  total,
  activeIndex,
  onSelect,
}: {
  total: number;
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const i18n = useInterfaceTranslations("InterfaceComponentsBrandPanel");
  return (
    <div className="mt-3 flex items-center gap-2">
      {Array.from({ length: total }).map((_, index) => (
        <button
          key={index}
          type="button"
          aria-label={i18n("Show perk {value0}", { value0: index + 1 })}
          onClick={() => onSelect(index)}
          className={cn(
            "h-1.5 rounded-full transition-all duration-500",
            index === activeIndex ? "w-8 bg-brand-red" : "w-2 bg-white/40",
          )}
        />
      ))}
    </div>
  );
}

function BrandStats({ stats }: { stats: readonly Stat[] }) {
  const i18n = useInterfaceTranslations("InterfaceComponentsBrandPanel");
  return (
    <div className="mt-auto grid grid-cols-3 gap-3 pt-10">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15 backdrop-blur-sm"
        >
          <p className="text-lg font-black text-brand-gold">{stat.value}</p>
          <p className="text-[10px] uppercase tracking-wide text-white/80">
            {i18n(stat.label)}
          </p>
        </div>
      ))}
    </div>
  );
}
