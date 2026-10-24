import { BASE_CURRENCY } from "@/lib/currency/config";
import { jsPDF } from "jspdf";

import { siteConfig } from "@/lib/seo/site";

/**
 * Shared branding primitives for every SexToy-generated PDF
 * (order receipts, admin reports, …).
 *
 * Centralising the palette, logo loader, header, and footer keeps the
 * different documents visually consistent and means a brand tweak only
 * has to happen in one place. Everything here is browser-side only —
 * the logo is fetched from the public folder at generation time.
 */

export type RGB = [number, number, number];
export type Doc = jsPDF;
export type BadgeStyle = { bg: RGB; fg: RGB };
export type LoadedImage = { dataUrl: string; width: number; height: number };

/** Brand + UI palette (mirrors the on-screen theme). */
export const PDF_COLORS = {
  primary: [225, 6, 0] as RGB, // Brand_Red #E10600
  primaryDark: [184, 0, 0] as RGB, // Brand_Red_Hover #B80000
  primarySoft: [248, 248, 248] as RGB, // Brand_Light_Bg #F8F8F8
  bg: [248, 248, 248] as RGB, // Brand_Light_Bg #F8F8F8
  card: [255, 255, 255] as RGB, // #FFFFFF
  border: [229, 231, 235] as RGB, // Brand_Border #E5E7EB
  text: [17, 17, 17] as RGB, // Brand_Text_Dark #111111
  muted: [107, 114, 128] as RGB, // Brand_Text_Muted #6B7280
  warnBg: [254, 243, 199] as RGB, // #FEF3C7
  warnText: [146, 64, 14] as RGB, // #92400E
  successBg: [220, 252, 231] as RGB, // #DCFCE7
  successText: [22, 101, 52] as RGB, // #166534
  dangerBg: [254, 226, 226] as RGB, // #FEE2E2
  dangerText: [153, 27, 27] as RGB, // #991B1B
  neutralBg: [243, 244, 246] as RGB, // gray-100 (safe fallback)
  neutralText: [55, 65, 81] as RGB, // gray-700
  white: [255, 255, 255] as RGB,
  zebra: [248, 248, 248] as RGB, // alt row tint
};

export const PAGE_MARGIN = 14;
export const HEADER_HEIGHT = 36;
export const FOOTER_HEIGHT = 16;
export const LINE_HEIGHT = 4.8;

export const STORE_INFO = {
  name: siteConfig.name,
  tagline: "Local Marketplace",
  email: siteConfig.contact.email,
};

/** Public path to the brand logo (served from `public/logo/wordmark.svg`). */
const LOGO_SRC = "/logo/wordmark.svg";

/* -------------------------------------------------------------------------- */
/*  Text / value helpers                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Money formatter. Uses an authoritative ISO currency prefix, comma-grouped, and only
 * shows decimals when they carry information — so we render `USD 2,342`
 * and `USD 2,579.10` but never a raw float like `USD 2579.1`.
 */
export function formatCurrency(value: number, currency: string = BASE_CURRENCY): string {
  const safe = Number.isFinite(value) ? value : 0;
  const rounded = Math.round((safe + Number.EPSILON) * 100) / 100;
  const hasFraction = Math.abs(rounded % 1) > 0.0001;
  const formatted = rounded.toLocaleString("en-US", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
  const safeCurrency = /^[A-Z]{3}$/.test(currency.trim().toUpperCase())
    ? currency.trim().toUpperCase()
    : BASE_CURRENCY;
  return `${safeCurrency} ${formatted}`;
}

export function formatBDT(value: number): string {
  return formatCurrency(value, "BDT");
}

/** Strip control characters and trim; fall back when empty/missing. */
export function safeText(value: string | null | undefined, fallback = ""): string {
  if (value == null) return fallback;
  const cleaned = String(value).replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

export function formatStamp(value: string): string {
  try {
    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return safeText(value);
  }
}

/** Title-case an UPPER_SNAKE enum value into readable text. */
export function titleCase(value: string): string {
  return safeText(value)
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Maps any order/payment/product status to a coloured badge style.
 * Positive states are green, in-progress/awaiting states are amber,
 * terminal failures are red, and anything unknown gets a safe neutral
 * style.
 */
export function badgeFor(status: string): BadgeStyle {
  const s = safeText(status).toUpperCase();
  if (
    [
      "DELIVERED",
      "PAID",
      "CONFIRMED",
      "PAYMENT_CONFIRMED",
      "COMPLETED",
      "SUCCESS",
      "SHIPPED",
      "ACTIVE",
    ].includes(s)
  ) {
    return { bg: PDF_COLORS.successBg, fg: PDF_COLORS.successText };
  }
  if (
    [
      "CANCELLED",
      "CANCELED",
      "FAILED",
      "REFUNDED",
      "RETURNED",
      "RETURN_REQUESTED",
      "DECLINED",
      "INACTIVE",
    ].includes(s)
  ) {
    return { bg: PDF_COLORS.dangerBg, fg: PDF_COLORS.dangerText };
  }
  if (
    [
      "PENDING",
      "PROCESSING",
      "SELLER_TO_PACK",
      "PACKED",
      "READY_TO_SHIP",
      "WAREHOUSE",
      "IN_TRANSIT",
      "OUT_FOR_DELIVERY",
      "UNPAID",
      "COD",
      "CASH_ON_DELIVERY",
    ].includes(s)
  ) {
    return { bg: PDF_COLORS.warnBg, fg: PDF_COLORS.warnText };
  }
  return { bg: PDF_COLORS.neutralBg, fg: PDF_COLORS.neutralText };
}

/* -------------------------------------------------------------------------- */
/*  Logo                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Loads the brand logo from the public folder and returns it as a data
 * URL plus its natural dimensions, ready for `doc.addImage`. Returns
 * `null` (so the header falls back to the wordmark) when running on the
 * server or if the asset can't be fetched/decoded.
 */
export async function loadBrandLogo(): Promise<LoadedImage | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch(LOGO_SRC, { cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read logo."));
      reader.readAsDataURL(blob);
    });

    const img = await new Promise<HTMLImageElement>(
      (resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to decode logo."));
        img.src = dataUrl;
      },
    );

    if (!img.naturalWidth || !img.naturalHeight) return null;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(img, 0, 0);
    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Primitive drawing helpers                                                 */
/* -------------------------------------------------------------------------- */

export function paintBackground(doc: Doc): void {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFillColor(...PDF_COLORS.bg);
  doc.rect(0, 0, pw, ph, "F");
}

export function drawCard(
  doc: Doc,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  doc.setFillColor(...PDF_COLORS.card);
  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2.5, 2.5, "FD");
}

export function drawSectionLabel(doc: Doc, x: number, y: number, label: string): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.primary);
  doc.text(label.toUpperCase(), x, y);
}

/** Draws a pill badge. `align: "right"` ends the pill at `x`. */
export function drawBadge(
  doc: Doc,
  x: number,
  y: number,
  label: string,
  style: BadgeStyle,
  align: "left" | "right" = "left",
): number {
  const text = safeText(label).toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  const padX = 3.2;
  const h = 6.4;
  const w = doc.getTextWidth(text) + padX * 2;
  const drawX = align === "right" ? x - w : x;
  doc.setFillColor(...style.bg);
  doc.roundedRect(drawX, y, w, h, h / 2, h / 2, "F");
  doc.setTextColor(...style.fg);
  doc.text(text, drawX + w / 2, y + h / 2 + 0.9, { align: "center" });
  return w;
}

/** Reads the Y where the most recent autoTable finished, plus a gap. */
export function getAutoTableEndY(doc: Doc, gap = 10): number {
  const last = (doc as unknown as { lastAutoTable?: { finalY: number } })
    .lastAutoTable;
  return (last?.finalY ?? 0) + gap;
}

/** Adds a fresh, background-painted page when `needed` mm won't fit. */
export function ensureSpace(doc: Doc, y: number, needed: number): number {
  const ph = doc.internal.pageSize.getHeight();
  if (y + needed > ph - FOOTER_HEIGHT) {
    doc.addPage();
    paintBackground(doc);
    return PAGE_MARGIN;
  }
  return y;
}

/* -------------------------------------------------------------------------- */
/*  Header + footer                                                           */
/* -------------------------------------------------------------------------- */

export type BrandHeaderOptions = {
  /** Pre-loaded logo; pass the result of `loadBrandLogo()`. */
  logo: LoadedImage | null;
  /** Right-side pill caption, e.g. "ORDER RECEIPT" / "SALES OVERVIEW". */
  pillText: string;
  /** Small caption under the logo, e.g. the tagline or console name. */
  subtitle: string;
  /** ISO timestamp shown in the "Generated" line; defaults to now. */
  generatedAt?: string;
};

/** Draws the shared brand band (logo chip + pill + timestamp). */
export function drawBrandHeader(doc: Doc, opts: BrandHeaderOptions): void {
  const { logo, subtitle } = opts;
  const pw = doc.internal.pageSize.getWidth();

  doc.setFillColor(...PDF_COLORS.primary);
  doc.rect(0, 0, pw, HEADER_HEIGHT, "F");
  doc.setFillColor(...PDF_COLORS.primaryDark);
  doc.rect(0, HEADER_HEIGHT - 2, pw, 2, "F");

  // Brand block: logo on a white chip so any logo colour stays legible
  // on the brand band, falling back to the wordmark if it won't load.
  if (logo) {
    const maxH = 12;
    const maxW = 52;
    let logoH = maxH;
    let logoW = (logo.width / logo.height) * logoH;
    if (logoW > maxW) {
      logoW = maxW;
      logoH = (logo.height / logo.width) * logoW;
    }
    const padX = 3;
    const padY = 2.5;
    const chipW = logoW + padX * 2;
    const chipH = logoH + padY * 2;
    const chipX = PAGE_MARGIN;
    const chipY = 6;

    doc.setFillColor(...PDF_COLORS.white);
    doc.roundedRect(chipX, chipY, chipW, chipH, 2, 2, "F");
    doc.addImage(logo.dataUrl, "PNG", chipX + padX, chipY + padY, logoW, logoH);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_COLORS.white);
    doc.text(subtitle, PAGE_MARGIN, chipY + chipH + 5);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_COLORS.white);
    doc.setFontSize(22);
    doc.text(STORE_INFO.name, PAGE_MARGIN, 17);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(subtitle, PAGE_MARGIN, 24);
  }

  // Right-side pill.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const title = safeText(opts.pillText).toUpperCase();
  const padX = 4;
  const h = 8;
  const w = doc.getTextWidth(title) + padX * 2;
  const x = pw - PAGE_MARGIN - w;
  doc.setFillColor(...PDF_COLORS.white);
  doc.roundedRect(x, 10, w, h, h / 2, h / 2, "F");
  doc.setTextColor(...PDF_COLORS.primary);
  doc.text(title, x + w / 2, 10 + h / 2 + 1, { align: "center" });

  // Generated timestamp.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text(
    `Generated: ${formatStamp(opts.generatedAt ?? new Date().toISOString())}`,
    pw - PAGE_MARGIN,
    25,
    { align: "right" },
  );
}

/**
 * Draws the shared footer (divider, left caption lines, page numbers)
 * on every page. The first caption line is emphasised; the rest are
 * muted.
 */
export function drawBrandFooter(doc: Doc, leftLines: string[]): void {
  const pageCount = doc.getNumberOfPages();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const baseY = ph - FOOTER_HEIGHT;

    doc.setDrawColor(...PDF_COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(PAGE_MARGIN, baseY + 3, pw - PAGE_MARGIN, baseY + 3);

    leftLines.forEach((line, i) => {
      if (i === 0) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...PDF_COLORS.text);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...PDF_COLORS.muted);
      }
      doc.setFontSize(8);
      doc.text(line, PAGE_MARGIN, baseY + 8 + i * 4.5);
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(`Page ${page} of ${pageCount}`, pw - PAGE_MARGIN, baseY + 12.5, {
      align: "right",
    });
  }
}
