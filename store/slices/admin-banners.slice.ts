import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type {
  AdminBannersBundle,
  CarouselBannerRow,
  CategoryBannerRow,
  DealBannerRow,
  PromoBannerRow,
  TopBannerRow,
} from "@/features/admin-banners/api";

type AdminBannersState = AdminBannersBundle & {
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
};

const initialState: AdminBannersState = {
  carousel: [],
  category: [],
  top: [],
  deal: [],
  promo: [],
  isHydrated: false,
  isLoading: false,
  error: null,
};

const adminBannersSlice = createSlice({
  name: "adminBanners",
  initialState,
  reducers: {
    setAdminBanners(
      state,
      action: PayloadAction<AdminBannersBundle>,
    ) {
      state.carousel = action.payload.carousel;
      state.category = action.payload.category;
      state.top = action.payload.top;
      state.deal = action.payload.deal;
      state.promo = action.payload.promo;
      state.isHydrated = true;
      state.error = null;
    },
    upsertCarouselBanner(state, action: PayloadAction<CarouselBannerRow>) {
      const index = state.carousel.findIndex(
        (item) => item.id === action.payload.id,
      );
      if (index >= 0) state.carousel[index] = action.payload;
      else state.carousel.unshift(action.payload);
    },
    removeCarouselBanner(state, action: PayloadAction<string>) {
      state.carousel = state.carousel.filter(
        (item) => item.id !== action.payload,
      );
    },
    upsertCategoryBanner(state, action: PayloadAction<CategoryBannerRow>) {
      const index = state.category.findIndex(
        (item) => item.id === action.payload.id,
      );
      if (index >= 0) state.category[index] = action.payload;
      else state.category.unshift(action.payload);
    },
    removeCategoryBanner(state, action: PayloadAction<string>) {
      state.category = state.category.filter(
        (item) => item.id !== action.payload,
      );
    },
    upsertTopBanner(state, action: PayloadAction<TopBannerRow>) {
      const index = state.top.findIndex(
        (item) => item.id === action.payload.id,
      );
      if (index >= 0) state.top[index] = action.payload;
      else state.top.unshift(action.payload);
    },
    removeTopBanner(state, action: PayloadAction<string>) {
      state.top = state.top.filter((item) => item.id !== action.payload);
    },
    upsertDealBanner(state, action: PayloadAction<DealBannerRow>) {
      const index = state.deal.findIndex(
        (item) => item.id === action.payload.id,
      );
      if (index >= 0) state.deal[index] = action.payload;
      else state.deal.unshift(action.payload);
    },
    removeDealBanner(state, action: PayloadAction<string>) {
      state.deal = state.deal.filter((item) => item.id !== action.payload);
    },
    upsertPromoBanner(state, action: PayloadAction<PromoBannerRow>) {
      const index = state.promo.findIndex(
        (item) => item.id === action.payload.id,
      );
      if (index >= 0) state.promo[index] = action.payload;
      else state.promo.unshift(action.payload);
    },
    removePromoBanner(state, action: PayloadAction<string>) {
      state.promo = state.promo.filter((item) => item.id !== action.payload);
    },
    setAdminBannersLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setAdminBannersError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const {
  setAdminBanners,
  upsertCarouselBanner,
  removeCarouselBanner,
  upsertCategoryBanner,
  removeCategoryBanner,
  upsertTopBanner,
  removeTopBanner,
  upsertDealBanner,
  removeDealBanner,
  upsertPromoBanner,
  removePromoBanner,
  setAdminBannersLoading,
  setAdminBannersError,
} = adminBannersSlice.actions;

export default adminBannersSlice.reducer;
