import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { OrderDetail, OrderItem } from "@/features/orders/api";
import { paymentMethodLabel } from "@/features/orders/payment";
import {
  BASE_CURRENCY,
  type CurrencyCode,
} from "@/lib/currency/config";
import { formatMoney } from "@/lib/currency/format-money";
import {
  badgeFor,
  drawBadge,
  drawBrandFooter,
  drawBrandHeader,
  drawCard,
  drawSectionLabel,
  ensureSpace,
  formatStamp,
  getAutoTableEndY,
  HEADER_HEIGHT,
  LINE_HEIGHT,
  loadBrandLogo,
  PAGE_MARGIN,
  paintBackground,
  PDF_COLORS as C,
  safeText,
  STORE_INFO,
  titleCase,
  type Doc,
  type RGB,
} from "@/features/branding/pdf";

function formatCurrency(value: number, currency: CurrencyCode): string {
  // jsPDF's built-in Helvetica font cannot render every localized currency
  // symbol (notably the Bangladeshi taka glyph), so receipts ask the shared
  // Intl formatter for an unambiguous ISO-code presentation.
  return formatMoney(value, currency, {
    locale: "en-US",
    currencyDisplay: "code",
  });
}

function formatBDT(value: number): string {
  return formatCurrency(value, BASE_CURRENCY);
}

/**
 * Builds a downloadable, premium-styled order receipt PDF.
 *
 * Generation runs entirely in the browser (jsPDF + jspdf-autotable)
 * so we don't need a headless browser on the server. The same
 * `OrderDetail` payload that the page renders on screen is the
 * source of truth here, which keeps the visible receipt and the
 * downloaded PDF in lockstep.
 *
 * Only customer-facing fields are rendered — never admin-only data
 * such as buying price (which isn't part of `OrderDetail` anyway).
 * Shared brand chrome (palette, logo, header, footer) lives in
 * `features/branding/pdf`.
 */

/** Variant / SKU descriptor for an item, dropping raw hex colour swatches. */
function buildVariantText(item: OrderItem): string {
  const isHex =
    typeof item.color === "string" &&
    /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(item.color.trim());
  const variant = [isHex ? null : item.color, item.size]
    .map((part) => safeText(part))
    .filter(Boolean)
    .join(" / ");
  const segments: string[] = [];
  if (item.variantName) segments.push(safeText(item.variantName));
  if (variant) segments.push(variant);
  if (item.attributeSummary) segments.push(safeText(item.attributeSummary));
  if (item.sku) segments.push(`SKU: ${safeText(item.sku)}`);
  return segments.join("   ·   ") || "—";
}

/* -------------------------------------------------------------------------- */
/*  Sections                                                                  */
/* -------------------------------------------------------------------------- */

function drawSummaryStrip(doc: Doc, y: number, order: OrderDetail): number {
  const pw = doc.internal.pageSize.getWidth();
  const x = PAGE_MARGIN;
  const w = pw - PAGE_MARGIN * 2;
  const h = 24;

  drawCard(doc, x, y, w, h);

  // Order ID — highly visible.
  drawSectionLabel(doc, x + 6, y + 7, "Order ID");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...C.text);
  doc.text(`#${safeText(order.orderNumber, "—")}`, x + 6, y + 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.muted);
  doc.text(`Placed on ${formatStamp(order.createdAt)}`, x + 6, y + 20.5);

  // Status badges, stacked on the right.
  const rightX = x + w - 6;
  drawBadge(doc, rightX, y + 6, titleCase(order.status), badgeFor(order.status), "right");
  drawBadge(
    doc,
    rightX,
    y + 14.5,
    titleCase(order.paymentStatus),
    badgeFor(order.paymentStatus),
    "right",
  );

  return y + h + 6;
}

type InfoLine = { text: string; bold?: boolean; color?: RGB };

function drawInfoCard(
  doc: Doc,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  lines: InfoLine[][],
): void {
  drawCard(doc, x, y, w, h);
  drawSectionLabel(doc, x + 6, y + 7, label);
  let ty = y + 13.5;
  for (const group of lines) {
    const [{ bold, color }] = group;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(9);
    doc.setTextColor(...(color ?? C.text));
    for (const segment of group) {
      doc.text(segment.text, x + 6, ty);
      ty += LINE_HEIGHT;
    }
  }
}

/** Wrap each info line and tag every wrapped segment with its style. */
function wrapInfoLines(
  doc: Doc,
  lines: InfoLine[],
  width: number,
): { groups: InfoLine[][]; count: number } {
  let count = 0;
  const groups = lines.map((line) => {
    doc.setFont("helvetica", line.bold ? "bold" : "normal");
    doc.setFontSize(9);
    const parts = doc.splitTextToSize(line.text, width) as string[];
    count += parts.length;
    return parts.map((text) => ({ ...line, text }));
  });
  return { groups, count };
}

function drawPartyCards(doc: Doc, y: number, order: OrderDetail): number {
  const pw = doc.internal.pageSize.getWidth();
  const gap = 6;
  const w = (pw - PAGE_MARGIN * 2 - gap) / 2;
  const leftX = PAGE_MARGIN;
  const rightX = PAGE_MARGIN + w + gap;
  const innerW = w - 12;

  const fromLines: InfoLine[] = [
    { text: STORE_INFO.name, bold: true, color: C.text },
    { text: STORE_INFO.email, color: C.muted },
  ];

  const billLines: InfoLine[] = [
    { text: safeText(order.customerName, "Customer"), bold: true, color: C.text },
  ];
  if (order.customerEmail) {
    billLines.push({ text: safeText(order.customerEmail), color: C.muted });
  }
  if (safeText(order.customerPhone)) {
    billLines.push({ text: safeText(order.customerPhone), color: C.muted });
  }
  if (safeText(order.customerAddress)) {
    billLines.push({ text: safeText(order.customerAddress), color: C.muted });
  }
  const cityLine = [order.customerCity, order.customerPostalCode]
    .map((part) => safeText(part))
    .filter(Boolean)
    .join(" ");
  if (cityLine) {
    billLines.push({ text: cityLine, color: C.muted });
  }

  const from = wrapInfoLines(doc, fromLines, innerW);
  const bill = wrapInfoLines(doc, billLines, innerW);
  const maxCount = Math.max(from.count, bill.count);
  const cardH = 13.5 + maxCount * LINE_HEIGHT + 3;

  drawInfoCard(doc, leftX, y, w, cardH, "From / Seller", from.groups);
  drawInfoCard(doc, rightX, y, w, cardH, "Bill To / Ship To", bill.groups);

  return y + cardH + 6;
}

function drawOrderInfoCard(doc: Doc, y: number, order: OrderDetail): number {
  const pw = doc.internal.pageSize.getWidth();
  const x = PAGE_MARGIN;
  const w = pw - PAGE_MARGIN * 2;
  const h = 23;

  drawCard(doc, x, y, w, h);
  drawSectionLabel(doc, x + 6, y + 7, "Order Information");

  const cols = [
    { label: "Order Date", value: formatStamp(order.createdAt) },
    { label: "Order Status", value: titleCase(order.status) },
    { label: "Payment Method", value: paymentMethodLabel(order.paymentMethod) },
    { label: "Payment Status", value: titleCase(order.paymentStatus) },
  ];
  const colW = (w - 12) / cols.length;

  cols.forEach((col, i) => {
    const cx = x + 6 + i * colW;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    doc.text(col.label.toUpperCase(), cx, y + 13.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...C.text);
    doc.text(doc.splitTextToSize(col.value, colW - 3) as string[], cx, y + 19);
  });

  return y + h + 6;
}

function drawItemsTable(doc: Doc, y: number, order: OrderDetail): number {
  drawSectionLabel(doc, PAGE_MARGIN, y + 2, "Order Items");

  autoTable(doc, {
    startY: y + 5,
    head: [["Product", "Variant / SKU", "Qty", "Unit price", "Line total"]],
    body: order.items.map((item) => [
      safeText(item.productName, "Item"),
      buildVariantText(item),
      String(item.quantity),
      formatCurrency(item.unitPrice, order.currency),
      formatCurrency(item.totalPrice, order.currency),
    ]),
    theme: "striped",
    headStyles: {
      fillColor: C.primary,
      textColor: C.white,
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
    },
    bodyStyles: {
      textColor: C.text,
      fontSize: 9.5,
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      valign: "middle",
    },
    alternateRowStyles: { fillColor: C.zebra },
    styles: { lineColor: C.border, lineWidth: 0.1, overflow: "linebreak" },
    columnStyles: {
      0: { cellWidth: "auto", fontStyle: "bold", textColor: C.text },
      1: { cellWidth: 44, textColor: C.muted, fontSize: 8 },
      2: { cellWidth: 13, halign: "right" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 30, halign: "right", fontStyle: "bold" },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: PAGE_MARGIN },
  });

  return getAutoTableEndY(doc, 10);
}

function drawTotals(doc: Doc, y: number, order: OrderDetail): number {
  const pw = doc.internal.pageSize.getWidth();
  const w = 88;
  const x = pw - PAGE_MARGIN - w;

  const rows: Array<[string, string]> = [
    ["Subtotal", formatCurrency(order.subtotal, order.currency)],
  ];
  if (order.discountAmount > 0) {
    const label = order.promoCode
      ? `Discount (${safeText(order.promoCode)})`
      : "Discount";
    rows.push([
      label,
      `- ${formatCurrency(order.discountAmount, order.currency)}`,
    ]);
  }
  rows.push([
    "Delivery charge",
    order.deliveryCharge === 0
      ? "FREE"
      : formatCurrency(order.deliveryCharge, order.currency),
  ]);
  if (order.taxAmount > 0) {
    rows.push(["Tax", formatCurrency(order.taxAmount, order.currency)]);
  }
  if (order.advancePayment > 0) {
    rows.push([
      "Advance payment",
      `- ${formatCurrency(order.advancePayment, order.currency)}`,
    ]);
    rows.push([
      "Balance due",
      formatCurrency(
        Math.max(order.totalAmount - order.advancePayment, 0),
        order.currency,
      ),
    ]);
  }
  if (order.currency !== order.baseCurrency) {
    if (order.paymentMethod === "CASH_ON_DELIVERY") {
      rows.push([
        "COD amount due (BDT)",
        formatCurrency(
          Math.max(order.baseTotalAmount - order.baseAdvancePayment, 0),
          order.paymentCurrency,
        ),
      ]);
    }
  }

  const rowH = 6.2;
  const grandH = 12;
  const cardH = 13.5 + rows.length * rowH + 2 + grandH + 4;

  drawCard(doc, x, y, w, cardH);
  drawSectionLabel(doc, x + 6, y + 7, "Payment Summary");

  let ry = y + 14;
  doc.setFontSize(9.5);
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.muted);
    doc.text(label, x + 6, ry);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.text);
    doc.text(value, x + w - 6, ry, { align: "right" });
    ry += rowH;
  }

  // Highlighted grand total — the strongest element on the page.
  const barY = y + cardH - grandH - 3;
  doc.setFillColor(...C.primary);
  doc.roundedRect(x + 4, barY, w - 8, grandH, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.white);
  doc.setFontSize(9);
  doc.text("GRAND TOTAL", x + 8, barY + grandH / 2 + 1);
  doc.setFontSize(13);
  doc.text(formatCurrency(order.totalAmount, order.currency), x + w - 8, barY + grandH / 2 + 1.2, {
    align: "right",
  });

  return y + cardH + 6;
}

function drawNoteCard(doc: Doc, y: number, note: string): number {
  const pw = doc.internal.pageSize.getWidth();
  const x = PAGE_MARGIN;
  const w = pw - PAGE_MARGIN * 2;
  const innerW = w - 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const parts = doc.splitTextToSize(note, innerW) as string[];
  const cardH = 13.5 + parts.length * LINE_HEIGHT + 3;

  y = ensureSpace(doc, y, cardH + 4);

  drawCard(doc, x, y, w, cardH);
  // Accent bar for a premium touch.
  doc.setFillColor(...C.primary);
  doc.roundedRect(x, y, 2.5, cardH, 1, 1, "F");

  drawSectionLabel(doc, x + 7, y + 7, "Customer Note");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...C.muted);
  let ty = y + 13.5;
  for (const part of parts) {
    doc.text(part, x + 7, ty);
    ty += LINE_HEIGHT;
  }

  return y + cardH + 6;
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

export { formatBDT, formatCurrency };

export async function generateOrderPdf(order: OrderDetail): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  // The embedded Helvetica document template is English. Advertising Bengali
  // here would require a font with shaping support rather than substituting text.
  doc.setLanguage("en");

  const logo = await loadBrandLogo();

  paintBackground(doc);
  drawBrandHeader(doc, {
    logo,
    pillText: "Order Receipt",
    subtitle: `${STORE_INFO.tagline}  ·  ${STORE_INFO.email}`,
  });

  let y = HEADER_HEIGHT + 8;
  y = drawSummaryStrip(doc, y, order);
  y = drawPartyCards(doc, y, order);
  y = drawOrderInfoCard(doc, y, order);
  y = drawItemsTable(doc, y, order);

  y = ensureSpace(doc, y, 76);
  y = drawTotals(doc, y, order);

  const note = safeText(order.customerNote);
  if (note) {
    drawNoteCard(doc, y, note);
  }

  drawBrandFooter(doc, [
    `Thank you for shopping with ${STORE_INFO.name}.`,
    `For support, contact ${STORE_INFO.email}`,
  ]);

  return doc;
}

/** Save the PDF with a sensible default filename. */
export async function downloadOrderPdf(order: OrderDetail): Promise<void> {
  const doc = await generateOrderPdf(order);
  doc.save(`${STORE_INFO.name}-${order.orderNumber}.pdf`);
}
