"use client";

import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { Provider as ReduxProvider } from "react-redux";

import CurrencyProvider from "@/components/currency/CurrencyProvider";
import { makeStore } from "@/store";
import {
  DEFAULT_CURRENCY_CONTEXT,
  type CurrencyContext,
} from "@/lib/currency/config";
import Toaster from "@/components/ui/Toaster";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import StoreHydrator from "@/components/layout/StoreHydrator";
import LocaleDraftMonitor from "@/components/i18n/LocaleDraftMonitor";

/**
 * Single client-side provider tree mounted by the root layout.
 *
 * Wraps the app in:
 *   - NextAuth's `SessionProvider` so any descendant client component can
 *     call `useSession`, `signIn`, or `signOut`.
 *   - The Redux store so dispatch/select hooks work app-wide.
 *   - `<StoreHydrator />` to populate cart/wishlist from localStorage
 *     (and the server for authenticated users) on first mount so that
 *     navbar badges render the correct counts immediately.
 *   - `<Toaster />` for lightweight toast notifications (small actions).
 *   - `<ConfirmDialog />` for SweetAlert-style confirmation modals (major actions).
 *
 * Kept as one file so the root layout only mounts one client boundary.
 */
export default function Providers({
  children,
  initialCurrencyContext = DEFAULT_CURRENCY_CONTEXT,
}: {
  children: React.ReactNode;
  initialCurrencyContext?: CurrencyContext;
}) {
  const [store] = useState(makeStore);

  return (
    <CurrencyProvider initialContext={initialCurrencyContext}>
      <SessionProvider>
        <LocaleDraftMonitor />
        <ReduxProvider store={store}>
          <StoreHydrator />
          {children}
          <Toaster />
          <ConfirmDialog />
        </ReduxProvider>
      </SessionProvider>
    </CurrencyProvider>
  );
}
