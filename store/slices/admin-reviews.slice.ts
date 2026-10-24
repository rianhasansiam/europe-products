import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { AdminReviewRow } from "@/features/admin-reviews/api";

type AdminReviewsState = {
  items: AdminReviewRow[];
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
};

const initialState: AdminReviewsState = {
  items: [],
  isHydrated: false,
  isLoading: false,
  error: null,
};

const adminReviewsSlice = createSlice({
  name: "adminReviews",
  initialState,
  reducers: {
    setAdminReviews(state, action: PayloadAction<AdminReviewRow[]>) {
      state.items = action.payload;
      state.isHydrated = true;
      state.error = null;
    },
    prependAdminReview(state, action: PayloadAction<AdminReviewRow>) {
      state.items.unshift(action.payload);
    },
    removeAdminReview(state, action: PayloadAction<string>) {
      state.items = state.items.filter((item) => item.id !== action.payload);
    },
    setAdminReviewsLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setAdminReviewsError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const {
  setAdminReviews,
  prependAdminReview,
  removeAdminReview,
  setAdminReviewsLoading,
  setAdminReviewsError,
} = adminReviewsSlice.actions;

export default adminReviewsSlice.reducer;
