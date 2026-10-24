import { createElement, Fragment } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderToStaticMarkup } from "./helpers/intl";
import { getGoogleAuthCredentials } from "@/lib/auth/google";
import AuthProviderAvailability from "@/app/(auth)/_components/AuthProviderAvailability";
import { GoogleSignInButton, SocialDivider } from "@/app/(auth)/_components/GoogleSignInButton";

const mocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  google: vi.fn((options: object) => ({ id: "google", ...options })),
}));

vi.mock("next-auth", () => ({
  default: mocks.initialize,
  CredentialsSignin: class extends Error {},
}));
vi.mock("next-auth/providers/google", () => ({ default: mocks.google }));
vi.mock("next-auth/providers/credentials", () => ({
  default: (options: object) => ({ id: "credentials", ...options }),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/auth/passwords", () => ({ verifyPassword: vi.fn() }));
vi.mock("@/lib/auth/rate-limit", () => ({ rateLimit: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  mocks.initialize.mockReturnValue({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() });
});
afterEach(() => vi.unstubAllEnvs());

describe("optional Google authentication", () => {
  it.each([
    {},
    { AUTH_GOOGLE_ID: "configured-client.apps.googleusercontent.com" },
    { AUTH_GOOGLE_ID: "  ", AUTH_GOOGLE_SECRET: "configured-secret" },
    { AUTH_GOOGLE_ID: "YOUR_GOOGLE_CLIENT_ID", AUTH_GOOGLE_SECRET: "configured-secret" },
    { AUTH_GOOGLE_ID: "configured-client.apps.googleusercontent.com", AUTH_GOOGLE_SECRET: "REPLACE_WITH_GOOGLE_SECRET" },
    { AUTH_GOOGLE_ID: "<google-client-id>", AUTH_GOOGLE_SECRET: "<google-client-secret>" },
  ])("omits incomplete and template credentials without exposing them", (environment) => {
    expect(getGoogleAuthCredentials(environment)).toBeNull();
  });

  it("retains both configured credentials", () => {
    expect(getGoogleAuthCredentials({
      AUTH_GOOGLE_ID: " configured-client.apps.googleusercontent.com ",
      AUTH_GOOGLE_SECRET: " configured-secret ",
    })).toEqual({ clientId: "configured-client.apps.googleusercontent.com", clientSecret: "configured-secret" });
  });

  it.each([false, true])("registers Google only when configured=%s, while retaining password login", async (configured) => {
    vi.stubEnv("AUTH_GOOGLE_ID", configured ? "configured-client.apps.googleusercontent.com" : "YOUR_GOOGLE_CLIENT_ID");
    vi.stubEnv("AUTH_GOOGLE_SECRET", configured ? "configured-secret" : "");
    await import("@/lib/auth/auth");

    const configuration = mocks.initialize.mock.calls.at(-1)?.[0] as { providers: Array<{ id: string }> };
    expect(configuration.providers.map((provider) => provider.id)).toEqual(configured ? ["google", "credentials"] : ["credentials"]);
    if (configured) {
      expect(mocks.google).toHaveBeenCalledWith({
        clientId: "configured-client.apps.googleusercontent.com", clientSecret: "configured-secret",
        authorization: { params: { prompt: "select_account" } },
      });
    } else {
      expect(mocks.google).not.toHaveBeenCalled();
    }
  });

  it.each([false, true])("shows the Google button and its divider only when available=%s", (available) => {
    const content = createElement(Fragment, null, createElement(SocialDivider), createElement(GoogleSignInButton));
    const markup = renderToStaticMarkup(createElement(AuthProviderAvailability, {
      googleSignInAvailable: available,
    }, content));
    expect(markup.includes("Continue with Google")).toBe(available);
    expect(markup.includes("or continue with")).toBe(available);
    expect(markup).not.toContain("configured-secret");
  });
});
