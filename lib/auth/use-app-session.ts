"use client";

import { useSession as useNextAuthSession } from "next-auth/react";

import type { AppSession } from "@/lib/auth/session";

type NextAuthSessionResult = ReturnType<typeof useNextAuthSession>;

export type AppSessionResult = Omit<NextAuthSessionResult, "data"> & {
  data: AppSession | null;
};

/** Typed client hook for the id/role fields populated by auth callbacks. */
export function useSession(): AppSessionResult {
  return useNextAuthSession() as AppSessionResult;
}
