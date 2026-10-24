
import { useInterfaceTranslations } from "@/components/i18n/translate";
import * as LucideIcons from "lucide-react";

import type { FeatureGridBlock } from "@/lib/types/product-description-blocks";
import { cn } from "@/lib/utils";

function LucideIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (
    LucideIcons as unknown as Record<
      string,
      React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
    >
  )[name];
  if (!Icon) return null;
  return <Icon className={className} aria-hidden />;
}

const GRID_COLS: Record<2 | 3 | 4, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export default function FeatureGridBlockView({
  block,
}: {
  block: FeatureGridBlock;
}) {
  const i18n = useInterfaceTranslations("InterfaceProductProductDescriptionBlocksFeatureGridBlockView");
  if (block.items.length === 0) return null;
  return (
    <section
      className="min-w-0"
      aria-labelledby={block.heading ? `fg-${block.id}` : undefined}
    >
      {block.heading?.trim() && (
        <h2
          id={`fg-${block.id}`}
          className="mb-6 text-xl font-bold text-gray-900 [overflow-wrap:anywhere]"
        >
          {block.heading}
        </h2>
      )}
      <ul
        className={cn("grid min-w-0 gap-4", GRID_COLS[block.columns])}
        aria-label={block.heading?.trim() ? undefined : i18n("Feature highlights")}
      >
        {block.items.map((item) => (
          <li
            key={item.id}
            className="flex min-w-0 flex-col gap-2 rounded-2xl border border-brand-border bg-white p-4 sm:p-5"
          >
            {item.icon && (
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
                <LucideIcon name={item.icon} className="h-5 w-5" />
              </span>
            )}
            <p className="font-semibold text-gray-900 [overflow-wrap:anywhere]">
              {item.title}
            </p>
            {item.description?.trim() && (
              <p className="text-sm text-gray-600 [overflow-wrap:anywhere]">
                {item.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
