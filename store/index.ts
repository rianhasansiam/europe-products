import { configureStore } from "@reduxjs/toolkit";

import adminBannersReducer from "@/store/slices/admin-banners.slice";
import adminCapitalCostsReducer from "@/store/slices/admin-capital-costs.slice";
import adminCategoriesReducer from "@/store/slices/admin-categories.slice";
import adminMessagesReducer from "@/store/slices/admin-messages.slice";
import adminOrdersReducer from "@/store/slices/admin-orders.slice";
import adminProductsReducer from "@/store/slices/admin-products.slice";
import adminReportsReducer from "@/store/slices/admin-reports.slice";
import adminReviewsReducer from "@/store/slices/admin-reviews.slice";
import adminSettingsReducer from "@/store/slices/admin-settings.slice";
import adminTestimonialsReducer from "@/store/slices/admin-testimonials.slice";
import adminUsersReducer from "@/store/slices/admin-users.slice";
import cartReducer from "@/store/slices/cart.slice";
import wishlistReducer from "@/store/slices/wishlist.slice";

export function makeStore() {
  return configureStore({
    reducer: {
      wishlist: wishlistReducer,
      cart: cartReducer,
      adminProducts: adminProductsReducer,
      adminOrders: adminOrdersReducer,
      adminUsers: adminUsersReducer,
      adminCategories: adminCategoriesReducer,
      adminBanners: adminBannersReducer,
      adminSettings: adminSettingsReducer,
      adminMessages: adminMessagesReducer,
      adminReports: adminReportsReducer,
      adminReviews: adminReviewsReducer,
      adminTestimonials: adminTestimonialsReducer,
      adminCapitalCosts: adminCapitalCostsReducer,
    },
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
