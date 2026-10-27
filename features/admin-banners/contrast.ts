import { resolveColorValue } from "@/components/ui/tailwind-palette";

type BannerBackground = {
  readonly bgType: "solid" | "gradient";
  readonly bgColor?: string | null;
  readonly bgFrom?: string | null;
  readonly bgVia?: string | null;
  readonly bgTo?: string | null;
};

export type BannerTextColors = {
  readonly foreground: string;
  readonly body: string;
  readonly primary: string;
};

function luminance(color: string) {
  const resolved = resolveColorValue(color);
  if (!resolved) return null;
  const hex = resolved.slice(1);
  const expanded = hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(expanded.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return {
    value: channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722,
    translucent: expanded.length === 8 && expanded.slice(6).toLowerCase() !== "ff",
  };
}

/** Advisory only: imagery and masking still require a full-banner preview. */
export function hasPotentialBannerContrastIssue(background: BannerBackground, text: BannerTextColors): boolean {
  const stops = background.bgType === "solid"
    ? [background.bgColor]
    : [background.bgFrom, background.bgVia, background.bgTo];
  const roles = [
    { color: text.foreground, minimum: 3 },
    { color: text.body, minimum: 4.5 },
    { color: text.primary, minimum: 3 },
  ];

  return stops.some((stop) => {
    const fill = stop ? luminance(stop) : null;
    if (!fill) return false;
    // A transparent stop depends on the image underneath; do not imply safety.
    if (fill.translucent) return true;
    return roles.some(({ color, minimum }) => {
      const ink = luminance(color);
      if (!ink) return false;
      const ratio = (Math.max(fill.value, ink.value) + 0.05) / (Math.min(fill.value, ink.value) + 0.05);
      return ratio < minimum;
    });
  });
}
