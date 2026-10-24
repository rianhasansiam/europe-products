
import { useInterfaceTranslations } from "@/components/i18n/translate";
import { cn } from "@/lib/utils";

/**
 * ColorBadge
 * ----------
 * Renders a product variant's color + size for customer-facing surfaces
 * (cart, checkout, order summary, profile).
 *
 * Admins may save a color name ("Black") or a hex value ("#1e3a8a"). Hex
 * values render as a swatch instead of exposing the raw code; named colors
 * render as text. `size` is always shown as text.
 */

const HEX_VALUE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function isHexColor(value: string | null | undefined): boolean {
  return typeof value === "string" && HEX_VALUE.test(value.trim());
}

export default function ColorBadge({
  color,
  size,
  className,
}: {
  color?: string | null;
  size?: string | null;
  className?: string;
}) {
  const i18n = useInterfaceTranslations("InterfaceUiColorBadge");
  const hasColor = Boolean(color && color.trim());
  const hasSize = Boolean(size && size.trim());
  if (!hasColor && !hasSize) return null;

  const colorIsHex = isHexColor(color);

  return (
    <span
      className={cn(
        "inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-medium text-brand-text-muted [overflow-wrap:anywhere]",
        className,
      )}
    >
      {hasColor &&
        (colorIsHex ? (
          <span
            className="inline-block h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-inset ring-black/15"
            style={{ backgroundColor: color as string }}
            title={color as string}
            aria-label={i18n("Color {value0}", { value0: color ?? "" })}
          />
        ) : (
          <span className="min-w-0 max-w-full">{color}</span>
        ))}
      {hasSize && (
        <span className="inline-flex min-w-0 max-w-full items-start gap-1.5">
          {hasColor && <span className="shrink-0 text-gray-300">/</span>}
          <span className="min-w-0 max-w-full [overflow-wrap:anywhere]">
            {size}
          </span>
        </span>
      )}
    </span>
  );
}
