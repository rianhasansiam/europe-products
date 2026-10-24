import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOCALE_COOKIE } from "@/lib/i18n/registry";
const mocks = vi.hoisted(() => ({ userId: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { update: mocks.update } } }));
vi.mock("@/lib/i18n/preferences", () => ({ getPreferenceUserId: mocks.userId }));
vi.mock("@/lib/i18n/server", () => ({ getPublishedLanguages: async () => [{ code: "en" }, { code: "bn" }] }));
import { POST } from "@/app/api/language/route";

function request(locale: string, origin = "https://bangbuy.test") {
  return new NextRequest("https://bangbuy.test/api/language", { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify({ locale }) });
}
beforeEach(() => { vi.stubEnv("AUTH_URL", "https://bangbuy.test"); mocks.userId.mockResolvedValue(null); mocks.update.mockResolvedValue({}); });

describe("explicit preferences", () => {
  it.each(["en", "bn"])("persists %s in a secure durable site-wide cookie", async (locale) => {
    const response = await POST(request(locale));
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain(`${LOCALE_COOKIE}=${locale}`);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Max-Age=31536000");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("updates only the authenticated user's preferredLocale", async () => {
    mocks.userId.mockResolvedValue("user-1");
    const response = await POST(request("bn"));
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { preferredLocale: "bn" } });
    expect((await response.json()).data.profilePersisted).toBe(true);
  });
  it("preserves browser support when the additive profile migration is unavailable", async () => {
    mocks.userId.mockResolvedValue("user-1"); mocks.update.mockRejectedValue(new Error("migration unavailable"));
    const response = await POST(request("bn"));
    expect(response.headers.get("set-cookie")).toContain(`${LOCALE_COOKIE}=bn`);
    expect((await response.json()).data.profilePersisted).toBe(false);
  });
  it("rejects disabled or unavailable languages without setting a preference", async () => {
    const response = await POST(request("ar"));
    expect(response.status).toBe(400); expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("rejects cross-origin writes before any profile mutation", async () => {
    const response = await POST(request("bn", "https://untrusted.test"));
    expect(response.status).toBe(403); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("bounds preference bodies before parsing or writing", async () => {
    const response = await POST(request("b".repeat(2_000)));
    expect(response.status).toBe(413);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
