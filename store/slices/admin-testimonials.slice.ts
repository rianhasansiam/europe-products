import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { AdminTestimonialRow } from "@/features/admin-testimonials/api";

type AdminTestimonialsState = {
  items: AdminTestimonialRow[];
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
};

const initialState: AdminTestimonialsState = {
  items: [],
  isHydrated: false,
  isLoading: false,
  error: null,
};

const adminTestimonialsSlice = createSlice({
  name: "adminTestimonials",
  initialState,
  reducers: {
    setAdminTestimonials(state, action: PayloadAction<AdminTestimonialRow[]>) {
      state.items = action.payload;
      state.isHydrated = true;
      state.error = null;
    },
    upsertAdminTestimonial(state, action: PayloadAction<AdminTestimonialRow>) {
      const index = state.items.findIndex(
        (item) => item.id === action.payload.id,
      );
      if (index >= 0) {
        state.items[index] = action.payload;
      } else {
        state.items.unshift(action.payload);
      }
    },
    removeAdminTestimonial(state, action: PayloadAction<string>) {
      state.items = state.items.filter((item) => item.id !== action.payload);
    },
    setAdminTestimonialsLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setAdminTestimonialsError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const {
  setAdminTestimonials,
  upsertAdminTestimonial,
  removeAdminTestimonial,
  setAdminTestimonialsLoading,
  setAdminTestimonialsError,
} = adminTestimonialsSlice.actions;

export default adminTestimonialsSlice.reducer;
