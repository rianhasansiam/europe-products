import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { AdminMessageRow } from "@/features/admin-messages/api";

type AdminMessagesState = {
  items: AdminMessageRow[];
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
};

const initialState: AdminMessagesState = {
  items: [],
  isHydrated: false,
  isLoading: false,
  error: null,
};

const adminMessagesSlice = createSlice({
  name: "adminMessages",
  initialState,
  reducers: {
    setAdminMessages(state, action: PayloadAction<AdminMessageRow[]>) {
      state.items = action.payload;
      state.isHydrated = true;
      state.error = null;
    },
    patchAdminMessage(
      state,
      action: PayloadAction<{
        id: string;
        changes: Partial<AdminMessageRow>;
      }>,
    ) {
      const index = state.items.findIndex(
        (item) => item.id === action.payload.id,
      );
      if (index >= 0) {
        state.items[index] = {
          ...state.items[index],
          ...action.payload.changes,
        };
      }
    },
    removeAdminMessage(state, action: PayloadAction<string>) {
      state.items = state.items.filter((item) => item.id !== action.payload);
    },
    setAdminMessagesLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setAdminMessagesError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const {
  setAdminMessages,
  patchAdminMessage,
  removeAdminMessage,
  setAdminMessagesLoading,
  setAdminMessagesError,
} = adminMessagesSlice.actions;

export default adminMessagesSlice.reducer;
