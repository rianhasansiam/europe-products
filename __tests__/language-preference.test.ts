import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ userId: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { update: mocks.update } } }));
vi.mock("@/lib/i18n/preferences", () => ({ getPreferenceUserId: mocks.userId }));
import { POST } from "@/app/api/language/route";

const handleLegacyRequest: (request: NextRequest) => ReturnType<typeof POST> = POST;

beforeEach(() => {
  mocks.userId.mockResolvedValue("user-1");
});

describe("retired language preferences", () => {
  it.each(["en", "bn", "ar"])("rejects a %s preference without saving a cookie or profile", async (locale) => {
    const request = new NextRequest("https://bangbuy.test/api/language", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://bangbuy.test" },
      body: JSON.stringify({ locale }),
    });
    const response = await handleLegacyRequest(request);
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: "Language switching is no longer available." });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(request.bodyUsed).toBe(false);
    expect(mocks.userId).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns the retired response without parsing malformed request bodies", async () => {
    const request = new NextRequest("https://bangbuy.test/api/language", { method: "POST", body: "not JSON" });
    const response = await handleLegacyRequest(request);
    expect(response.status).toBe(410);
    expect(request.bodyUsed).toBe(false);
    expect(mocks.userId).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
