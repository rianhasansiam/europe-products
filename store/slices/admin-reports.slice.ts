import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { ReportPayload, ReportType } from "@/features/admin-reports/api";

type AdminReportsState = {
  type: ReportType;
  from: string;
  to: string;
  limit: number;
  allTime: boolean;
  payload: ReportPayload | null;
  isLoading: boolean;
  error: string | null;
  generatedAt: string | null;
};

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const range = defaultRange();

const initialState: AdminReportsState = {
  type: "sales",
  from: range.from,
  to: range.to,
  limit: 100,
  allTime: false,
  payload: null,
  isLoading: false,
  error: null,
  generatedAt: null,
};

const slice = createSlice({
  name: "adminReports",
  initialState,
  reducers: {
    setReportType(state, action: PayloadAction<ReportType>) {
      state.type = action.payload;
      state.payload = null;
    },
    setFrom(state, action: PayloadAction<string>) {
      state.from = action.payload;
      state.allTime = false;
    },
    setTo(state, action: PayloadAction<string>) {
      state.to = action.payload;
      state.allTime = false;
    },
    setLimit(state, action: PayloadAction<number>) {
      state.limit = action.payload;
    },
    setAllTime(state, action: PayloadAction<boolean>) {
      state.allTime = action.payload;
    },
    setReportLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setReportError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setReportPayload(state, action: PayloadAction<ReportPayload>) {
      state.payload = action.payload;
      state.generatedAt = action.payload.meta.generatedAt;
      state.error = null;
    },
    clearReport(state) {
      state.payload = null;
      state.generatedAt = null;
    },
  },
});

export const {
  setReportType,
  setFrom,
  setTo,
  setLimit,
  setAllTime,
  setReportLoading,
  setReportError,
  setReportPayload,
  clearReport,
} = slice.actions;

export default slice.reducer;
