"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useCallback, useState } from "react";
import { AlertCircle } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";

import {
  clearReport,
  setAllTime,
  setFrom,
  setLimit,
  setReportError,
  setReportLoading,
  setReportPayload,
  setReportType,
  setTo,
} from "@/store/slices/admin-reports.slice";
import type { AppDispatch, RootState } from "@/store";
import {
  fetchReport,
  REPORT_DEFS,
  type ReportType,
} from "@/features/admin-reports/api";
import { downloadReportPdf } from "@/features/admin-reports/pdf";

import ReportFilters from "./components/ReportFilters";
import ReportPreview from "./components/ReportPreview";
import ReportTypePicker from "./components/ReportTypePicker";

/**
 * Admin · Reports
 *
 * Workflow:
 *   1. Pick a report type (sales / orders / products / inventory / customers / categories).
 *   2. Choose a date window and an optional record cap.
 *   3. Hit "Generate report" — the API returns a fully aggregated payload.
 *   4. Preview on screen. When everything looks right, hit "Download PDF"
 *      and jsPDF builds the file in the browser, no server roundtrip.
 *
 * Redux holds the report state so it survives navigation back to the
 * page within the same session.
 */
export default function AdminReportsPage() {
  const i18n = useInterfaceTranslations("AdminAdminReportsPage");
  const dispatch = useDispatch<AppDispatch>();
  const reportState = useSelector((state: RootState) => state.adminReports);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleTypeChange = useCallback(
    (next: ReportType) => {
      dispatch(setReportType(next));
      setDownloadError(null);
    },
    [dispatch],
  );

  const handlePresetWindow = useCallback(
    (days: number) => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - days);
      dispatch(setFrom(from.toISOString().slice(0, 10)));
      dispatch(setTo(to.toISOString().slice(0, 10)));
    },
    [dispatch],
  );

  const handleAllTimeChange = useCallback(
    (value: boolean) => {
      dispatch(setAllTime(value));
    },
    [dispatch],
  );

  const handleGenerate = useCallback(async () => {
    dispatch(setReportLoading(true));
    dispatch(setReportError(null));
    setDownloadError(null);

    try {
      const payload = await fetchReport({
        type: reportState.type,
        from: reportState.from || undefined,
        to: reportState.to || undefined,
        limit: reportState.limit,
        allTime: reportState.allTime,
      });
      dispatch(setReportPayload(payload));
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to generate report.";
      dispatch(setReportError(message));
      dispatch(clearReport());
    } finally {
      dispatch(setReportLoading(false));
    }
  }, [dispatch, reportState.from, reportState.limit, reportState.to, reportState.type, reportState.allTime]);

  const handleDownload = useCallback(async () => {
    if (!reportState.payload) return;
    setIsDownloading(true);
    setDownloadError(null);
    try {
      // Yield a frame so the spinner can paint before jsPDF blocks
      // the main thread on big reports.
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      await downloadReportPdf(reportState.payload);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to build PDF.";
      setDownloadError(message);
    } finally {
      setIsDownloading(false);
    }
  }, [reportState.payload]);

  const activeDef = REPORT_DEFS[reportState.type];

  return (
    <section className="space-y-5">
      {/* Hero */}
      <header className="rounded-2xl border border-brand-border bg-brand-black p-5 text-white shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">
          {i18n("Reports")}</p>
        <h1 className="mt-1 text-xl font-extrabold">{i18n("Generate & download reports")}</h1>
        <p className="mt-1 text-sm text-white/70">
          {i18n("Pick a report, set the window, preview the data, and export a polished PDF for sharing with the team.")}</p>
        <p className="mt-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-white/30">
          {i18n("Currently selected ·")}{" "}{activeDef.label}
        </p>
      </header>

      <p className="text-xs text-gray-500">{i18n("Financial summaries include USD orders only.")}</p>


      <div>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
          {i18n("Choose a report")}</h2>
        <ReportTypePicker
          value={reportState.type}
          onChange={handleTypeChange}
          disabled={reportState.isLoading}
        />
      </div>

      <ReportFilters
        from={reportState.from}
        to={reportState.to}
        limit={reportState.limit}
        allTime={reportState.allTime}
        isLoading={reportState.isLoading}
        onFromChange={(value) => dispatch(setFrom(value))}
        onToChange={(value) => dispatch(setTo(value))}
        onLimitChange={(value) => dispatch(setLimit(value))}
        onAllTimeChange={handleAllTimeChange}
        onGenerate={() => {
          void handleGenerate();
        }}
        onPresetWindow={handlePresetWindow}
      />

      {reportState.error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-bold">{i18n("Couldn't generate the report")}</p>
            <p className="mt-0.5">{i18n(reportState.error)}</p>
          </div>
        </div>
      )}

      {downloadError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-bold">{i18n("Couldn't build the PDF")}</p>
            <p className="mt-0.5">{downloadError}</p>
          </div>
        </div>
      )}

      <ReportPreview
        payload={reportState.payload}
        isLoading={reportState.isLoading}
        isDownloading={isDownloading}
        onDownload={() => {
          void handleDownload();
        }}
      />
    </section>
  );
}
