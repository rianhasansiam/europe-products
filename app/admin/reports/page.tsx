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
  setTo,
} from "@/store/slices/admin-reports.slice";
import type { AppDispatch, RootState } from "@/store";
import {
  fetchReport,
} from "@/features/admin-reports/api";
import { downloadReportPdf } from "@/features/admin-reports/pdf";

import ReportFilters from "./components/ReportFilters";
import ReportPreview from "./components/ReportPreview";

/** Sales reports with date controls, preview, and PDF export. */
export default function AdminReportsPage() {
  const i18n = useInterfaceTranslations("AdminAdminReportsPage");
  const dispatch = useDispatch<AppDispatch>();
  const reportState = useSelector((state: RootState) => state.adminReports);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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

  return (
    <section className="space-y-5">
      {/* Hero */}
      <header className="rounded-2xl border border-brand-border bg-brand-black p-5 text-white shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">
          {i18n("Reports")}</p>
        <h1 className="mt-1 text-xl font-extrabold">{i18n("Sales reports")}</h1>
        <p className="mt-1 text-sm text-white/70">
          {i18n("Choose a date window, review your sales, and download a PDF.")}</p>
      </header>

      <p className="text-xs text-gray-500">{i18n("Sales totals include USD orders only.")}</p>


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
