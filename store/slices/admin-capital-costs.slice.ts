import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type {
  ActivityRow,
  CapitalRecord,
  CapitalCostSummary,
  OtherCostRow,
  ProductCostSummary,
} from "@/features/admin-capital-costs/api";

/**
 * Client cache for the Admin Capital & Cost Tracker. Mirrors the other
 * admin slices: a hydration flag so the page only fetches once, plus the
 * running capital, the derived product cost, the manual cost list, and a
 * recent-activity feed.
 */

type AdminCapitalCostsState = {
  capital: CapitalRecord | null;
  productCost: ProductCostSummary | null;
  summary: CapitalCostSummary | null;
  otherCosts: OtherCostRow[];
  activity: ActivityRow[];
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
};

const initialState: AdminCapitalCostsState = {
  capital: null,
  productCost: null,
  summary: null,
  otherCosts: [],
  activity: [],
  isHydrated: false,
  isLoading: false,
  error: null,
};

const adminCapitalCostsSlice = createSlice({
  name: "adminCapitalCosts",
  initialState,
  reducers: {
    setCapitalCostOverview(
      state,
      action: PayloadAction<{
        capital: CapitalRecord | null;
        productCost: ProductCostSummary | null;
        summary: CapitalCostSummary | null;
        otherCosts: OtherCostRow[];
        activity: ActivityRow[];
      }>,
    ) {
      state.capital = action.payload.capital;
      state.productCost = action.payload.productCost;
      state.summary = action.payload.summary;
      state.otherCosts = action.payload.otherCosts;
      state.activity = action.payload.activity;
      state.isHydrated = true;
      state.error = null;
    },
    setCapital(state, action: PayloadAction<CapitalRecord | null>) {
      state.capital = action.payload;
    },
    setCapitalCostSummary(
      state,
      action: PayloadAction<CapitalCostSummary | null>,
    ) {
      state.summary = action.payload;
    },
    setProductCost(
      state,
      action: PayloadAction<ProductCostSummary | null>,
    ) {
      state.productCost = action.payload;
    },
    setActivity(state, action: PayloadAction<ActivityRow[]>) {
      state.activity = action.payload;
    },
    setOtherCosts(state, action: PayloadAction<OtherCostRow[]>) {
      state.otherCosts = action.payload;
    },
    upsertOtherCost(state, action: PayloadAction<OtherCostRow>) {
      const index = state.otherCosts.findIndex(
        (cost) => cost.id === action.payload.id,
      );
      if (index >= 0) {
        state.otherCosts[index] = action.payload;
      } else {
        state.otherCosts.unshift(action.payload);
      }
    },
    removeOtherCost(state, action: PayloadAction<string>) {
      state.otherCosts = state.otherCosts.filter(
        (cost) => cost.id !== action.payload,
      );
    },
    setCapitalCostsLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setCapitalCostsError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const {
  setCapitalCostOverview,
  setCapital,
  setCapitalCostSummary,
  setProductCost,
  setActivity,
  setOtherCosts,
  upsertOtherCost,
  removeOtherCost,
  setCapitalCostsLoading,
  setCapitalCostsError,
} = adminCapitalCostsSlice.actions;

export default adminCapitalCostsSlice.reducer;
