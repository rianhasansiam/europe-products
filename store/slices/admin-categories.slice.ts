import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { AdminCategoryRow } from "@/features/admin-categories/api";

type AdminCategoriesState = {
  items: AdminCategoryRow[];
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
};

const initialState: AdminCategoriesState = {
  items: [],
  isHydrated: false,
  isLoading: false,
  error: null,
};

const adminCategoriesSlice = createSlice({
  name: "adminCategories",
  initialState,
  reducers: {
    setAdminCategories(state, action: PayloadAction<AdminCategoryRow[]>) {
      state.items = action.payload;
      state.isHydrated = true;
      state.error = null;
    },
    upsertAdminCategory(state, action: PayloadAction<AdminCategoryRow>) {
      const index = state.items.findIndex(
        (item) => item.id === action.payload.id,
      );
      if (index >= 0) {
        // Preserve productCount when the API returns a row that doesn't
        // include it (e.g. update endpoint just returns the bare select).
        const existing = state.items[index];
        state.items[index] = {
          ...action.payload,
          productCount:
            action.payload.productCount > 0
              ? action.payload.productCount
              : existing.productCount,
        };
      } else {
        state.items.unshift(action.payload);
      }
    },
    patchAdminCategory(
      state,
      action: PayloadAction<{ id: string; changes: Partial<AdminCategoryRow> }>,
    ) {
      const index = state.items.findIndex(
        (item) => item.id === action.payload.id,
      );
      if (index >= 0) {
        state.items[index] = { ...state.items[index], ...action.payload.changes };
      }
    },
    removeAdminCategory(state, action: PayloadAction<string>) {
      state.items = state.items.filter((item) => item.id !== action.payload);
    },
    setAdminCategoriesLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setAdminCategoriesError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const {
  setAdminCategories,
  upsertAdminCategory,
  patchAdminCategory,
  removeAdminCategory,
  setAdminCategoriesLoading,
  setAdminCategoriesError,
} = adminCategoriesSlice.actions;

export default adminCategoriesSlice.reducer;
