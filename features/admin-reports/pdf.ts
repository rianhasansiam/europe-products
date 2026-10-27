import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  REPORT_DEFS,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  type ReportPayload,
  type SalesReport,
} from "@/features/admin-reports/api";
import {
  drawBadge,
  drawBrandFooter,
  drawBrandHeader,
  drawCard,
  drawSectionLabel,
  ensureSpace,
  getAutoTableEndY,
  HEADER_HEIGHT,
  loadBrandLogo,
  PAGE_MARGIN,
  paintBackground,
  PDF_COLORS as C,
  safeText,
  STORE_INFO,
  titleCase,
  type Doc,
} from "@/features/branding/pdf";

/**
 * Generates a downloadable PDF for the sales report.
 *
 * The same payload that powers the on-screen preview drives the PDF, so
 * the two can never disagree. Generation runs entirely on the client
 * (jsPDF + jspdf-autotable) — no headless browser needed. Shared brand
 * chrome (palette, logo, header, footer) lives in `features/branding/pdf`.
 *
 * Every section follows the same skeleton:
 *   1. Shared brand header + a title card (subject, description, window).
 *   2. Summary KPIs rendered as a card grid.
 *   3. One or more styled detail tables with daily sales and order details.
 *   4. Shared footer with page numbers.
 */

type Kpi = { label: string; value: string };
type Column = {
  header: string;
  align?: "left" | "right" | "center";
  width?: number | "auto";
  bold?: boolean;
};

/* -------------------------------------------------------------------------- */
/*  Reusable building blocks                                                  */
/* -------------------------------------------------------------------------- */

function drawTitleCard(doc: Doc, y: number, payload: ReportPayload): number {
  const def = REPORT_DEFS[payload.meta.type];
  const pw = doc.internal.pageSize.getWidth();
  const x = PAGE_MARGIN;
  const w = pw - PAGE_MARGIN * 2;
  const innerW = w - 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const descParts = doc.splitTextToSize(def.description, innerW) as string[];
  const h = 21 + descParts.length * 4.6 + 11;

  drawCard(doc, x, y, w, h);
  // Left accent bar.
  doc.setFillColor(...C.primary);
  doc.roundedRect(x, y, 2.5, h, 1, 1, "F");

  drawSectionLabel(doc, x + 7, y + 7, def.label);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...C.text);
  doc.text(def.subject, x + 7, y + 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.muted);
  let ty = y + 21;
  for (const part of descParts) {
    doc.text(part, x + 7, ty);
    ty += 4.6;
  }

  // Window badge.
  drawBadge(
    doc,
    x + 7,
    ty - 1,
    payload.meta.allTime
      ? "Window: All time"
      : `Window: ${formatDate(payload.meta.from)} - ${formatDate(payload.meta.to)}`,
    { bg: C.primarySoft, fg: C.primaryDark },
    "left",
  );

  return y + h + 6;
}

function drawKpiCards(doc: Doc, startY: number, kpis: Kpi[]): number {
  if (kpis.length === 0) return startY;

  const pw = doc.internal.pageSize.getWidth();
  const x0 = PAGE_MARGIN;
  const totalW = pw - PAGE_MARGIN * 2;
  const perRow = 3;
  const gap = 5;
  const cardW = (totalW - gap * (perRow - 1)) / perRow;
  const cardH = 18;
  const rowCount = Math.ceil(kpis.length / perRow);

  const startedY = ensureSpace(doc, startY, rowCount * (cardH + gap) + 4);

  kpis.forEach((kpi, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const x = x0 + col * (cardW + gap);
    const cy = startedY + row * (cardH + gap);

    drawCard(doc, x, cy, cardW, cardH);
    doc.setFillColor(...C.primary);
    doc.roundedRect(x, cy, 2, cardH, 1, 1, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    const labelParts = (
      doc.splitTextToSize(kpi.label.toUpperCase(), cardW - 12) as string[]
    ).slice(0, 2);
    let ly = cy + 5.5;
    for (const part of labelParts) {
      doc.text(part, x + 6, ly);
      ly += 3.4;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...C.text);
    doc.text(
      (doc.splitTextToSize(kpi.value, cardW - 12) as string[]).slice(0, 1),
      x + 6,
      cy + 15,
    );
  });

  return startedY + rowCount * cardH + (rowCount - 1) * gap + 8;
}

function drawSection(doc: Doc, y: number, label: string): number {
  const safeY = ensureSpace(doc, y, 24);
  drawSectionLabel(doc, PAGE_MARGIN, safeY, label);
  return safeY + 4;
}

function drawDataTable(
  doc: Doc,
  startY: number,
  columns: Column[],
  rows: string[][],
  bodyFontSize = 9,
): number {
  const columnStyles: Record<number, Record<string, unknown>> = {};
  columns.forEach((col, i) => {
    columnStyles[i] = {
      halign: col.align ?? "left",
      ...(col.width != null ? { cellWidth: col.width } : {}),
      ...(col.bold ? { fontStyle: "bold" } : {}),
    };
  });

  autoTable(doc, {
    startY,
    head: [columns.map((col) => col.header)],
    body: rows,
    theme: "striped",
    headStyles: {
      fillColor: C.primary,
      textColor: C.white,
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: { top: 2.6, right: 3, bottom: 2.6, left: 3 },
    },
    bodyStyles: {
      textColor: C.text,
      fontSize: bodyFontSize,
      cellPadding: { top: 2.4, right: 3, bottom: 2.4, left: 3 },
      valign: "middle",
    },
    alternateRowStyles: { fillColor: C.zebra },
    styles: { lineColor: C.border, lineWidth: 0.1, overflow: "linebreak" },
    columnStyles,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: PAGE_MARGIN },
  });

  return getAutoTableEndY(doc, 10);
}

/* -------------------------------------------------------------------------- */
/*  Per-report renderers                                                      */
/* -------------------------------------------------------------------------- */

function renderSales(doc: Doc, report: SalesReport, startY: number): void {
  let y = drawKpiCards(doc, startY, [
    { label: "Total sales", value: formatCurrency(report.summary.totalSales) },
    { label: "Orders (live)", value: formatNumber(report.summary.totalOrders) },
    { label: "Cancelled orders", value: formatNumber(report.summary.cancelledOrders) },
  ]);

  if (report.byStatus.length > 0) {
    y = drawSection(doc, y, "Orders by status");
    y = drawDataTable(
      doc,
      y,
      [
        { header: "Status" },
        { header: "Orders", align: "right", width: 28 },
        { header: "Sales", align: "right", width: 40, bold: true },
      ],
      report.byStatus.map((row) => [
        titleCase(row.status),
        formatNumber(row.orders),
        formatCurrency(row.sales),
      ]),
    );
  }

  if (report.byPaymentStatus.length > 0) {
    y = drawSection(doc, y, "Payment status (live orders)");
    y = drawDataTable(
      doc,
      y,
      [
        { header: "Payment status" },
        { header: "Orders", align: "right", width: 28 },
        { header: "Sales", align: "right", width: 40, bold: true },
      ],
      report.byPaymentStatus.map((row) => [
        titleCase(row.paymentStatus),
        formatNumber(row.orders),
        formatCurrency(row.sales),
      ]),
    );
  }

  if (report.dailySeries.length > 0) {
    y = drawSection(doc, y, "Daily sales");
    y = drawDataTable(
      doc,
      y,
      [
        { header: "Date" },
        { header: "Orders", align: "right", width: 28 },
        { header: "Sales", align: "right", width: 40, bold: true },
      ],
      report.dailySeries.map((row) => [
        formatDate(row.day),
        formatNumber(row.orders),
        formatCurrency(row.sales),
      ]),
    );
  }

  if (report.recentOrders.length > 0) {
    y = drawSection(doc, y, "Recent orders");
    drawDataTable(
      doc,
      y,
      [
        { header: "Order #", bold: true },
        { header: "Customer" },
        { header: "Status", width: 22 },
        { header: "Payment", width: 20 },
        { header: "Total", align: "right", width: 28, bold: true },
        { header: "Placed", width: 34 },
      ],
      report.recentOrders.map((row) => [
        safeText(row.orderNumber),
        safeText(row.customerName, "—"),
        titleCase(row.status),
        titleCase(row.paymentStatus),
        formatCurrency(row.totalAmount),
        formatDateTime(row.createdAt),
      ]),
      8,
    );
  }
}

export async function generateReportPdf(payload: ReportPayload): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  doc.setLanguage("en");

  const logo = await loadBrandLogo();
  const def = REPORT_DEFS[payload.meta.type];

  paintBackground(doc);
  drawBrandHeader(doc, {
    logo,
    pillText: def.subject,
    subtitle: "Admin Console  ·  Reports",
    generatedAt: payload.meta.generatedAt,
  });

  const y = drawTitleCard(doc, HEADER_HEIGHT + 8, payload);

  renderSales(doc, payload.sales, y);

  drawBrandFooter(doc, [`${STORE_INFO.name} Admin · Confidential`, "Sales totals include USD orders only."]);
  return doc;
}

export function buildReportFilename(payload: ReportPayload): string {
  const stamp = payload.meta.generatedAt.replace(/[:.]/g, "-").slice(0, 19);
  return `${STORE_INFO.name.toLowerCase()}-${payload.meta.type}-report-${stamp}.pdf`;
}

export async function downloadReportPdf(payload: ReportPayload): Promise<void> {
  const doc = await generateReportPdf(payload);
  doc.save(buildReportFilename(payload));
}
