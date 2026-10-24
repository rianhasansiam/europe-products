import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  REPORT_DEFS,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  type CategoriesReport,
  type CustomersReport,
  type InventoryReport,
  type OrdersReport,
  type ProductsReport,
  type ProfitReport,
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
 * Generates a downloadable, premium-styled PDF for any admin report.
 *
 * The same payload that powers the on-screen preview drives the PDF, so
 * the two can never disagree. Generation runs entirely on the client
 * (jsPDF + jspdf-autotable) — no headless browser needed. Shared brand
 * chrome (palette, logo, header, footer) lives in `features/branding/pdf`.
 *
 * Every section follows the same skeleton:
 *   1. Shared brand header + a title card (subject, description, window).
 *   2. Summary KPIs rendered as a card grid.
 *   3. One or more styled detail tables specific to the report type.
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
    { label: "Total revenue", value: formatCurrency(report.summary.totalRevenue) },
    { label: "Orders (live)", value: formatNumber(report.summary.totalOrders) },
    { label: "Avg order value", value: formatCurrency(report.summary.avgOrderValue) },
    { label: "Gross subtotal", value: formatCurrency(report.summary.grossSubtotal) },
    { label: "Delivery fees", value: formatCurrency(report.summary.totalDeliveryCharges) },
    { label: "Discounts applied", value: formatCurrency(report.summary.totalDiscounts) },
    { label: "Cancelled orders", value: formatNumber(report.summary.cancelledOrders) },
    { label: "Cancelled revenue", value: formatCurrency(report.summary.cancelledRevenue) },
  ]);

  if (report.byStatus.length > 0) {
    y = drawSection(doc, y, "Orders by status");
    y = drawDataTable(
      doc,
      y,
      [
        { header: "Status" },
        { header: "Orders", align: "right", width: 28 },
        { header: "Revenue", align: "right", width: 40, bold: true },
      ],
      report.byStatus.map((row) => [
        titleCase(row.status),
        formatNumber(row.orders),
        formatCurrency(row.revenue),
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
        { header: "Revenue", align: "right", width: 40, bold: true },
      ],
      report.byPaymentStatus.map((row) => [
        titleCase(row.paymentStatus),
        formatNumber(row.orders),
        formatCurrency(row.revenue),
      ]),
    );
  }

  if (report.dailySeries.length > 0) {
    y = drawSection(doc, y, "Daily revenue");
    y = drawDataTable(
      doc,
      y,
      [
        { header: "Date" },
        { header: "Orders", align: "right", width: 28 },
        { header: "Revenue", align: "right", width: 40, bold: true },
      ],
      report.dailySeries.map((row) => [
        formatDate(row.day),
        formatNumber(row.orders),
        formatCurrency(row.revenue),
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

function renderOrders(doc: Doc, report: OrdersReport, startY: number): void {
  let y = drawKpiCards(doc, startY, [
    { label: "Total orders", value: formatNumber(report.summary.totalOrders) },
    { label: "Total amount", value: formatCurrency(report.summary.totalAmount) },
    { label: "Total discounts", value: formatCurrency(report.summary.totalDiscounts) },
  ]);

  if (report.byStatus.length > 0) {
    y = drawSection(doc, y, "Orders by status");
    y = drawDataTable(
      doc,
      y,
      [
        { header: "Status" },
        { header: "Orders", align: "right", width: 32, bold: true },
      ],
      report.byStatus.map((row) => [
        titleCase(row.status),
        formatNumber(row.orders),
      ]),
    );
  }

  y = drawSection(doc, y, "Order log");
  drawDataTable(
    doc,
    y,
    [
      { header: "Order #", bold: true },
      { header: "Customer" },
      { header: "Phone", width: 26 },
      { header: "Status", width: 20 },
      { header: "Pay", width: 16 },
      { header: "Items", align: "right", width: 13 },
      { header: "Total", align: "right", width: 26, bold: true },
      { header: "Placed", width: 30 },
    ],
    report.rows.map((row) => [
      safeText(row.orderNumber),
      safeText(row.customerName, "—"),
      safeText(row.customerPhone, "—"),
      titleCase(row.status),
      titleCase(row.paymentStatus),
      formatNumber(row.itemsCount),
      formatCurrency(row.totalAmount),
      formatDateTime(row.createdAt),
    ]),
    8,
  );
}

function renderProducts(doc: Doc, report: ProductsReport, startY: number): void {
  let y = drawKpiCards(doc, startY, [
    { label: "Unique products sold", value: formatNumber(report.summary.uniqueProducts) },
    { label: "Total units shipped", value: formatNumber(report.summary.unitsSold) },
    { label: "Revenue", value: formatCurrency(report.summary.revenue) },
  ]);

  y = drawSection(doc, y, "Top products by revenue");
  drawDataTable(
    doc,
    y,
    [
      { header: "#", align: "right", width: 10 },
      { header: "Product", bold: true },
      { header: "Category", width: 32 },
      { header: "Units", align: "right", width: 16 },
      { header: "Revenue", align: "right", width: 30, bold: true },
      { header: "Price now", align: "right", width: 26 },
      { header: "Stock", align: "right", width: 16 },
      { header: "Status", width: 20 },
    ],
    report.rows.map((row, index) => [
      String(index + 1),
      safeText(row.name, "—"),
      safeText(row.category, "—"),
      formatNumber(row.unitsSold),
      formatCurrency(row.revenue),
      row.currentPrice != null ? formatCurrency(row.currentPrice) : "—",
      row.currentStock != null ? formatNumber(row.currentStock) : "—",
      row.status ? titleCase(row.status) : "—",
    ]),
    8.5,
  );
}

function renderProfit(doc: Doc, report: ProfitReport, startY: number): void {
  let y = drawKpiCards(doc, startY, [
    { label: "Revenue", value: formatCurrency(report.summary.totalRevenue) },
    { label: "Cost of goods", value: formatCurrency(report.summary.totalCost) },
    { label: "Gross profit", value: formatCurrency(report.summary.grossProfit) },
    { label: "Profit margin", value: `${report.summary.profitMargin}%` },
    { label: "Units sold", value: formatNumber(report.summary.unitsSold) },
    { label: "Products tracked", value: formatNumber(report.summary.productsTracked) },
  ]);

  y = drawSection(doc, y, "Profit by product");
  drawDataTable(
    doc,
    y,
    [
      { header: "#", align: "right", width: 12 },
      { header: "Product", bold: true },
      { header: "Category", width: 38 },
      { header: "Units", align: "right", width: 18 },
      { header: "Revenue", align: "right", width: 32 },
      { header: "Cost", align: "right", width: 30 },
      { header: "Profit", align: "right", width: 32, bold: true },
      { header: "Margin", align: "right", width: 22 },
      { header: "Stock", align: "right", width: 18 },
      { header: "Status", width: 26 },
    ],
    report.rows.map((row, index) => [
      String(index + 1),
      safeText(row.name, "—"),
      safeText(row.category, "—"),
      formatNumber(row.unitsSold),
      formatCurrency(row.revenue),
      formatCurrency(row.cost),
      formatCurrency(row.profit),
      `${row.margin}%`,
      row.currentStock != null ? formatNumber(row.currentStock) : "—",
      row.status ? titleCase(row.status) : "—",
    ]),
    8.5,
  );
}

function renderInventory(doc: Doc, report: InventoryReport, startY: number): void {
  let y = drawKpiCards(doc, startY, [
    { label: "Total products", value: formatNumber(report.summary.totalProducts) },
    { label: "Units in stock", value: formatNumber(report.summary.totalUnitsInStock) },
    { label: "Out of stock", value: formatNumber(report.summary.outOfStock) },
    { label: "Low stock (<= 5)", value: formatNumber(report.summary.lowStock) },
    { label: "Inventory value", value: formatCurrency(report.summary.inventoryValue) },
  ]);

  y = drawSection(doc, y, "Catalog (lowest stock first)");
  drawDataTable(
    doc,
    y,
    [
      { header: "Product", bold: true },
      { header: "Category", width: 32 },
      { header: "Price", align: "right", width: 26 },
      { header: "Discount", align: "right", width: 26 },
      { header: "Stock", align: "right", width: 16 },
      { header: "Status", width: 20 },
      { header: "Updated", width: 26 },
    ],
    report.rows.map((row) => [
      safeText(row.name, "—"),
      safeText(row.category, "—"),
      formatCurrency(row.price),
      row.discountPrice != null ? formatCurrency(row.discountPrice) : "—",
      formatNumber(row.stock),
      titleCase(row.status),
      formatDate(row.updatedAt),
    ]),
    8.5,
  );
}

function renderCustomers(doc: Doc, report: CustomersReport, startY: number): void {
  let y = drawKpiCards(doc, startY, [
    { label: "Total registered users", value: formatNumber(report.summary.totalUsers) },
    { label: "New sign-ups", value: formatNumber(report.summary.newSignupsInWindow) },
    { label: "Active buyers", value: formatNumber(report.summary.activeBuyers) },
    { label: "Total revenue", value: formatCurrency(report.summary.totalRevenue) },
    { label: "Avg revenue / buyer", value: formatCurrency(report.summary.avgRevenuePerBuyer) },
  ]);

  y = drawSection(doc, y, "Top customers");
  drawDataTable(
    doc,
    y,
    [
      { header: "Customer", bold: true },
      { header: "Email" },
      { header: "Phone", width: 26 },
      { header: "City", width: 22 },
      { header: "Role", width: 16 },
      { header: "Orders", align: "right", width: 16 },
      { header: "Spend", align: "right", width: 28, bold: true },
      { header: "Last order", width: 24 },
    ],
    report.rows.map((row) => [
      safeText(row.name, "—"),
      safeText(row.email, "—"),
      safeText(row.phone, "—"),
      safeText(row.city, "—"),
      titleCase(row.role),
      formatNumber(row.ordersCount),
      formatCurrency(row.totalSpend),
      row.lastOrderAt ? formatDate(row.lastOrderAt) : "—",
    ]),
    8,
  );
}

function renderCategories(doc: Doc, report: CategoriesReport, startY: number): void {
  let y = drawKpiCards(doc, startY, [
    { label: "Total categories", value: formatNumber(report.summary.totalCategories) },
    { label: "Active categories", value: formatNumber(report.summary.activeCategories) },
    { label: "Catalog products", value: formatNumber(report.summary.totalProducts) },
    { label: "Units sold", value: formatNumber(report.summary.unitsSold) },
    { label: "Revenue", value: formatCurrency(report.summary.revenue) },
  ]);

  y = drawSection(doc, y, "Direct category performance");
  y = drawDataTable(
    doc,
    y,
    [
      { header: "Category breadcrumb", bold: true },
      { header: "Path", width: 42 },
      { header: "Status", width: 20 },
      { header: "Direct products", align: "right", width: 25 },
      { header: "Units", align: "right", width: 18 },
      { header: "Revenue", align: "right", width: 30, bold: true },
    ],
    report.rows.map((row) => [
      safeText(row.breadcrumbLabel, "—"),
      `/${safeText(row.path)}`,
      titleCase(row.status),
      formatNumber(row.directProductCount),
      formatNumber(row.unitsSold),
      formatCurrency(row.revenue),
    ]),
    8,
  );

  y = drawSection(doc, y, "Root category rollups (non-duplicating)");
  drawDataTable(
    doc,
    y,
    [
      { header: "Root category", bold: true },
      { header: "Path", width: 42 },
      { header: "Status", width: 20 },
      { header: "Categories", align: "right", width: 22 },
      { header: "Products", align: "right", width: 22 },
      { header: "Units", align: "right", width: 18 },
      { header: "Revenue", align: "right", width: 30, bold: true },
    ],
    report.rootRollups.map((row) => [
      safeText(row.name, "—"),
      `/${safeText(row.path)}`,
      titleCase(row.status),
      formatNumber(row.categoryCount),
      formatNumber(row.totalProductCount),
      formatNumber(row.unitsSold),
      formatCurrency(row.revenue),
    ]),
    8,
  );
}

/* -------------------------------------------------------------------------- */
/*  Public entry                                                              */
/* -------------------------------------------------------------------------- */

export async function generateReportPdf(payload: ReportPayload): Promise<jsPDF> {
  // The profit report carries 10 columns of financial data; portrait A4
  // squeezes them so the product name wraps one letter per line. Render
  // it in landscape so every column gets a sane width. All the shared
  // chrome (header/footer/cards) reads the page width dynamically, so
  // they adapt automatically.
  const orientation = payload.meta.type === "profit" ? "landscape" : "portrait";
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation });
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

  switch (payload.meta.type) {
    case "sales":
      if (payload.sales) renderSales(doc, payload.sales, y);
      break;
    case "orders":
      if (payload.orders) renderOrders(doc, payload.orders, y);
      break;
    case "products":
      if (payload.products) renderProducts(doc, payload.products, y);
      break;
    case "profit":
      if (payload.profit) renderProfit(doc, payload.profit, y);
      break;
    case "inventory":
      if (payload.inventory) renderInventory(doc, payload.inventory, y);
      break;
    case "customers":
      if (payload.customers) renderCustomers(doc, payload.customers, y);
      break;
    case "categories":
      if (payload.categories) renderCategories(doc, payload.categories, y);
      break;
  }

  drawBrandFooter(doc, [`${STORE_INFO.name} Admin · Confidential`, "Financial summaries include USD orders only."]);
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
