"use client";

import { createContext, useContext, type ReactNode } from "react";

const GoogleSignInAvailable = createContext(false);

/** Only the availability boolean crosses the server/client boundary. */
export default function AuthProviderAvailability({
  googleSignInAvailable,
  children,
}: {
  googleSignInAvailable: boolean;
  children?: ReactNode;
}) {
  return (
    <GoogleSignInAvailable.Provider value={googleSignInAvailable}>
      {children}
    </GoogleSignInAvailable.Provider>
  );
}

export function useGoogleSignInAvailable(): boolean {
  return useContext(GoogleSignInAvailable);
}
