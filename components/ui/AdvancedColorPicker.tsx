"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import * as React from "react";
import { HexColorPicker } from "react-colorful";

import { cn } from "@/lib/utils";
import { classToHex } from "./tailwind-palette";

/**
 * AdvancedColorPicker
 * -------------------
 * A design-tool-style color control built on `react-colorful`:
 *   - large saturation / brightness area + hue slider,
 *   - a labelled opacity (alpha) slider with a live percentage,
 *   - a HEX field that shows / accepts the final value,
 *   - a swatch trigger that opens the picker in a popover.
 *
 * Value contract: a hex string. `#RRGGBB` when fully opaque, `#RRGGBBAA`
 * when the opacity is below 100%. Fully controlled — pass `value` and
 * handle `onChange`. Legacy Tailwind class strings (e.g. "bg-violet-600")
 * passed in as `value` are resolved to their hex equivalent for display so
 * older saved data still previews correctly.
 */

export type AdvancedColorPickerProps = {
  /** Current color, a hex string (`#RRGGBB` / `#RRGGBBAA`). */
  value: string;
  /** Emits the new hex string on every change. */
  onChange: (color: string) => void;
  /** Accessible name for the trigger, e.g. "Background color". */
  label?: string;
  /** Show the opacity slider + accept 8-digit hex. Default: true. */
  alpha?: boolean;
  /** Show the picker's built-in HEX field. Default: true. */
  showHexInput?: boolean;
  disabled?: boolean;
  className?: string;
};

/* ----------------------------- hex helpers ------------------------------ */

const HEX6 = /^#([0-9a-f]{6})$/i;
const HEX8 = /^#([0-9a-f]{8})$/i;
const HEX3 = /^#([0-9a-f]{3})$/i;

function toByteHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0");
}

function expandHex3(value: string): string {
  const m = HEX3.exec(value);
  if (!m) return value;
  const [r, g, b] = m[1].split("");
  return `#${r}${r}${g}${g}${b}${b}`;
}

/** Split any accepted color into a 6-digit base hex + alpha (0..1). */
function splitColor(value: string): { base: string; alpha: number } {
  const raw = (value ?? "").trim();

  if (HEX8.test(raw)) {
    return { base: `#${raw.slice(1, 7)}`, alpha: parseInt(raw.slice(7, 9), 16) / 255 };
  }
  if (HEX6.test(raw)) return { base: raw.toLowerCase(), alpha: 1 };
  if (HEX3.test(raw)) return { base: expandHex3(raw).toLowerCase(), alpha: 1 };

  // Legacy Tailwind class (e.g. "bg-violet-600") — resolve to hex for display.
  const fromClass = classToHex(raw);
  if (fromClass) return { base: fromClass.toLowerCase(), alpha: 1 };

  return { base: "#000000", alpha: 1 };
}

/** Recombine a base hex + alpha into the emitted value. */
function joinColor(base: string, alpha: number): string {
  const safeBase = HEX6.test(base) ? base.toLowerCase() : "#000000";
  if (alpha >= 1) return safeBase;
  return `${safeBase}${toByteHex(alpha * 255)}`;
}

export function AdvancedColorPicker({
  value,
  onChange,
  label = "Color",
  alpha = true,
  showHexInput = true,
  disabled = false,
  className,
}: AdvancedColorPickerProps) {
  const i18n = useInterfaceTranslations("InterfaceUiAdvancedColorPicker");
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const { base, alpha: currentAlpha } = splitColor(value);
  const opacityPct = Math.round(currentAlpha * 100);

  // Close on outside click + Escape.
  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleSaturationHue = (nextBase: string) => {
    onChange(joinColor(nextBase, alpha ? currentAlpha : 1));
  };

  const handleOpacity = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextAlpha = Number(event.target.value) / 100;
    onChange(joinColor(base, nextAlpha));
  };

  const handleHexInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const typed = event.target.value.trim();
    const normalized = typed.startsWith("#") ? typed : `#${typed}`;
    if (HEX8.test(normalized) || HEX6.test(normalized) || HEX3.test(normalized)) {
      const parts = splitColor(normalized);
      onChange(joinColor(parts.base, alpha ? parts.alpha : 1));
    }
  };

  // Trigger swatch shows the resolved color (with its alpha) over a checkerboard.
  const swatchColor = joinColor(base, alpha ? currentAlpha : 1);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={i18n("{value0}: {value1}. Click to edit.", { value0: label, value1: value || i18n("none") })}
        className={cn(
          "group flex h-10 w-full items-center gap-2.5 rounded-xl border border-violet-200 bg-white px-1.5 text-sm outline-none transition",
          "hover:border-violet-400 focus-visible:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-200",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span
          aria-hidden
          className="h-6 w-6 shrink-0  rounded-md ring-1 ring-inset ring-black/10"
          style={{
            backgroundColor: swatchColor,
            backgroundImage:
              "linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)",
            backgroundSize: "8px 8px",
            backgroundPosition: "0 0,0 4px,4px -4px,-4px 0",
          }}
        >
          <span
            className="block h-full w-full rounded-md"
            style={{ backgroundColor: swatchColor }}
          />
        </span>


        <span className="min-w-0 flex-1 truncate text-start font-mono text-xs uppercase text-gray-700">
          {value || i18n("Choose a color")}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={i18n("{value0} picker", { value0: label })}
          className="absolute -start-24  z-50 mt-2 w-[min(20rem,calc(100vw-3rem))] rounded-2xl border border-violet-100 bg-white p-3 shadow-xl ring-1 ring-black/5"
        >
          <HexColorPicker
            color={base}
            onChange={handleSaturationHue}
            className="advanced-color-picker"
          />

          {alpha && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm font-semibold text-violet-600">{i18n("Opacity")}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={opacityPct}
                onChange={handleOpacity}
                aria-label={i18n("Opacity")}
                className="advanced-opacity-slider h-2 flex-1 cursor-pointer appearance-none rounded-full"
                style={{
                  // Checkerboard base + a transparent→color gradient overlay.
                  backgroundImage: `linear-gradient(to right, transparent, ${base}), linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)`,
                  backgroundSize: "100% 100%, 10px 10px, 10px 10px, 10px 10px, 10px 10px",
                  backgroundPosition:
                    "0 0, 0 0, 0 5px, 5px -5px, -5px 0",
                }}
              />
              <span className="w-10 text-end text-sm font-bold text-gray-700">
                {opacityPct}%
              </span>
            </div>
          )}

          {showHexInput && (
            <div className="mt-3 flex items-center rounded-xl bg-gray-900 px-3 py-2.5">
              <span className="text-base font-bold text-gray-500">#</span>
              <input
                value={(value || "#000000").replace(/^#/, "").toUpperCase()}
                onChange={handleHexInput}
                spellCheck={false}
                aria-label={i18n("{value0} hex value", { value0: label })}
                className="w-full bg-transparent px-1 font-mono text-base font-bold uppercase tracking-wider text-white outline-none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdvancedColorPicker;
