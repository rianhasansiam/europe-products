import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guard: vi.fn(), dashboard: vi.fn(), jobs: vi.fn(), importCatalog: vi.fn(), publish: vi.fn() }));
vi.mock("@/lib/api/guards", () => ({ requireAdmin: mocks.guard }));
vi.mock("@/lib/translations/service", () => ({
  translationDashboard: mocks.dashboard,
  runTranslationJobs: mocks.jobs,
  setInterfaceCatalog: mocks.importCatalog,
  publishLanguage: mocks.publish,
}));
import { GET, POST } from "@/app/api/admin/translations/route";

function request(action: string, origin = "https://bangbuy.test") {
  return new Request("https://bangbuy.test/api/admin/translations", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ action, code: "bn", published: true }),
  });
}

beforeEach(() => {
  vi.stubEnv("AUTH_URL", "https://bangbuy.test");
  mocks.guard.mockResolvedValue({ ok: false, response: Response.json({ error: "Authentication required." }, { status: 401 }) });
});

describe("retired translation management", () => {
  it("preserves authentication checks before returning dashboard or write responses", async () => {
    expect((await GET()).status).toBe(401);
    expect((await POST(request("runJobs"))).status).toBe(401);
    expect(mocks.dashboard).not.toHaveBeenCalled();
    expect(mocks.jobs).not.toHaveBeenCalled();
  });

  it("preserves the admin requirement", async () => {
    mocks.guard.mockResolvedValue({ ok: false, response: Response.json({ error: "Admin access only." }, { status: 403 }) });
    expect((await GET()).status).toBe(403);
    expect((await POST(request("publishLanguage"))).status).toBe(403);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("retires the dashboard without reading translation data", async () => {
    mocks.guard.mockResolvedValue({ ok: true, session: { user: { id: "admin" } } });
    const response = await GET();
    expect(response.status).toBe(410);
    expect(mocks.dashboard).not.toHaveBeenCalled();
  });

  it.each(["runJobs", "importCatalog", "publishLanguage"])("rejects old %s actions without reading their bodies or running services", async (action) => {
    mocks.guard.mockResolvedValue({ ok: true, session: { user: { id: "admin" } } });
    const write = request(action);
    const response = await POST(write);
    expect(response.status).toBe(410);
    expect(write.bodyUsed).toBe(false);
    expect(mocks.jobs).not.toHaveBeenCalled();
    expect(mocks.importCatalog).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("continues rejecting cross-origin admin writes", async () => {
    mocks.guard.mockResolvedValue({ ok: true, session: { user: { id: "admin" } } });
    expect((await POST(request("runJobs", "https://untrusted.test"))).status).toBe(403);
    expect(mocks.jobs).not.toHaveBeenCalled();
  });

  it("continues rejecting fetches marked cross-site even with a matching Origin", async () => {
    mocks.guard.mockResolvedValue({ ok: true, session: { user: { id: "admin" } } });
    const write = request("publishLanguage");
    write.headers.set("sec-fetch-site", "cross-site");
    expect((await POST(write)).status).toBe(403);
    expect(mocks.publish).not.toHaveBeenCalled();
  });
});
