import { createTranslator as createIntlTranslator } from "next-intl";
import coreMessages from "@/messages/core-en.json";
import interfaceMessages from "@/messages/interface-en.json";
import adminMessages from "@/messages/admin-en.json";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "./helpers/intl";
import { describe, expect, it, vi } from "vitest";

import TransactionsTab from "@/app/(shop)/profile/components/TransactionsTab";
import TransactionsClient from "@/app/admin/transactions/TransactionsClient";
import type { AdminTransaction } from "@/features/transactions/api";

// Seed the loaded API response in the existing node test environment, then
// render the actual desktop/mobile admin rows and customer transaction cards.
const harness = vi.hoisted(() => ({
  states: [] as unknown[],
  stateCursor: 0,
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.stateCursor++;
    const value = index < harness.states.length
      ? harness.states[index]
      : typeof initial === "function" ? initial() : initial;
    return [value, vi.fn()];
  },
  useEffect: vi.fn(),
  useMemo: (compute: () => unknown) => compute(),
  useCallback: (callback: unknown) => callback,
}));

vi.mock("next/link", async () => {
  const { createElement: element } = await import("react");
  return {
    default: ({ children, ...props }: { children?: ReactNode; href: string }) =>
      element("a", props, children),
  };
});

const transaction: AdminTransaction = {
  id: "transaction-1", provider: "AIRWALLEX", transactionId: "payment-intent-1",
  bankTransactionId: null, cardType: null, amount: 100, currency: "BDT",
  status: "PROCESSING", paidAt: null, requiresReview: false, riskLevel: null,
  reviewReason: null, reviewResolvedAt: null, reviewResolvedBy: null,
  reviewResolution: null, reviewResolutionReference: null,
  createdAt: "2026-10-06T10:00:00.000Z", updatedAt: "2026-10-06T10:00:00.000Z",
  order: {
    id: "order-1", orderNumber: "ORDER-1", status: "PENDING", paymentMethod: "ONLINE",
    paymentStatus: "UNPAID", customerName: "Guest buyer", customerEmail: null,
    customerPhone: "01700000000", user: null,
  },
};

function renderScreen(screen: "admin" | "customer", status: string) {
  // The API client currently trusts the response status; exercise unexpected
  // values at that boundary as well as the newer provider state.
  const items = [{ ...transaction, status: status as AdminTransaction["status"] }];
  const meta = { page: 1, pageSize: 20, total: 1, totalPages: 1 };
  harness.states = screen === "admin"
    ? ["", "", "", "", "", 1, 0, items, meta, false, null]
    : ["ALL", 1, 0, { status: "ready", items, meta }];
  harness.stateCursor = 0;
  return renderToStaticMarkup(createElement(
    screen === "admin" ? TransactionsClient : TransactionsTab,
  ));
}

describe("transaction status rendering", () => {
  describe.each(["admin", "customer"] as const)("%s transactions", (screen) => {
    it("renders a newer Airwallex status without crashing", () => {
      const markup = renderScreen(screen, "PROCESSING");

      expect(markup.split(">Processing</span>")).toHaveLength(screen === "admin" ? 3 : 2);
      expect(markup).toContain("bg-blue-100 text-blue-800 ring-blue-200");
      expect(markup).toContain("payment-intent-1");
    });

    it.each(["FUTURE_PROVIDER_STATE", "__proto__"])(
      "renders a neutral badge for an unknown API status %s",
      (status) => {
        const markup = renderScreen(screen, status);

        expect(markup.split(">Unknown</span>")).toHaveLength(screen === "admin" ? 3 : 2);
        expect(markup).toContain("bg-gray-100 text-gray-700 ring-gray-200");
        expect(markup).toContain("payment-intent-1");
      },
    );
  });
});

vi.mock("next-intl", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-intl")>()),
  useLocale: () => "en",
  useTranslations: () => createIntlTranslator({ locale: "en", messages: { ...coreMessages, ...interfaceMessages, ...adminMessages } }),
}));
vi.mock("@/components/i18n/useLocaleDraft", () => ({ useLocaleDraft: () => undefined, useLocaleSwitchGuard: () => undefined }));
vi.mock("@/lib/i18n/navigation", async () => ({ ...(await import("next/navigation")), default: (await import("next/link")).default }));
