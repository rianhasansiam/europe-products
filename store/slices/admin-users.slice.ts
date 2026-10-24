import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { AdminCustomerRow, AdminUserRow } from "@/features/admin-users/api";

type AdminUsersState = {
  items: AdminCustomerRow[];
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
};

const initialState: AdminUsersState = {
  items: [],
  isHydrated: false,
  isLoading: false,
  error: null,
};

const adminUsersSlice = createSlice({
  name: "adminUsers",
  initialState,
  reducers: {
    setAdminUsers(state, action: PayloadAction<AdminCustomerRow[]>) {
      state.items = action.payload;
      state.isHydrated = true;
      state.error = null;
    },
    patchAdminUser(
      state,
      action: PayloadAction<{ id: string; changes: Partial<AdminUserRow> }>,
    ) {
      const index = state.items.findIndex(
        (item) =>
          item.customerType === "REGISTERED" && item.id === action.payload.id,
      );
      if (index >= 0) {
        const user = state.items[index];
        if (user.customerType === "REGISTERED") {
          state.items[index] = { ...user, ...action.payload.changes };
        }
      }
    },
    setAdminUsersLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setAdminUsersError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const {
  setAdminUsers,
  patchAdminUser,
  setAdminUsersLoading,
  setAdminUsersError,
} = adminUsersSlice.actions;

export default adminUsersSlice.reducer;
