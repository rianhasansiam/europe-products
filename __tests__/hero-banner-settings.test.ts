import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildCarouselForm,
  createCarouselBanner,
  parseBannersBundle,
  updateCarouselBanner,
  type CarouselBannerRow,
} from "@/features/admin-banners/api";
import {
  createCarouselBannerSchema,
  updateCarouselBannerSchema,
} from "@/lib/validations/banner.validation";

const merchant = {
  image: "/uploads/banners/merchant-original.webp",
  title: "Merchant title",
  subtitle: "Merchant highlight",
  description: "Merchant first line\nMerchant second line",
  badge: "Merchant badge",
  bgType: "gradient" as const,
  bgFrom: "#112233",
  bgVia: "#445566",
  bgTo: "#778899",
  bgColor: null,
  link: "/products?campaign=original",
  position: 7,
  status: "INACTIVE" as const,
};

function row(overrides: Partial<CarouselBannerRow> = {}): CarouselBannerRow {
  return {
    ...merchant,
    id: "merchant-banner",
    createdAt: "2026-10-25T00:00:00.000Z",
    updatedAt: "2026-10-25T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("hero banner settings contract", () => {
  it.each([
    { bgType: "gradient" as const, bgFrom: "#123", bgVia: "#44556688", bgTo: "#778899", bgColor: null },
    { bgType: "gradient" as const, bgFrom: "from-red-500", bgVia: "via-emerald-600", bgTo: "to-blue-700", bgColor: null },
    { bgType: "solid" as const, bgFrom: null, bgVia: null, bgTo: null, bgColor: "#12345600" },
    { bgType: "solid" as const, bgFrom: null, bgVia: null, bgTo: null, bgColor: "bg-violet-600" },
  ])("preserves saved merchant fields through validation, response parsing, and editor loading: %j", (colors) => {
    const payload = { ...merchant, ...colors };
    const validated = createCarouselBannerSchema.parse(payload);
    const parsed = parseBannersBundle({ success: true, data: { carousel: [row(validated)] } }).carousel[0];

    expect(validated).toEqual(payload);
    expect(parsed).toEqual(row(payload));
    expect(buildCarouselForm(parsed)).toEqual({
      image: payload.image,
      title: payload.title,
      subtitle: payload.subtitle,
      description: payload.description,
      badge: payload.badge,
      bgType: payload.bgType,
      bgFrom: payload.bgFrom ?? "",
      bgVia: payload.bgVia ?? "",
      bgTo: payload.bgTo ?? "",
      bgColor: payload.bgColor ?? "",
      link: payload.link,
      position: "7",
      status: "INACTIVE",
    });
  });

  it("keeps absent optional values empty in the editor instead of applying new-create defaults", () => {
    const original = row({ bgFrom: null, bgVia: null, bgTo: null, bgColor: null, link: null });
    expect(buildCarouselForm(original)).toMatchObject({
      bgFrom: "", bgVia: "", bgTo: "", bgColor: "", link: "",
      title: "Merchant title", badge: "Merchant badge", status: "INACTIVE",
    });
    expect(original).toEqual(row({ bgFrom: null, bgVia: null, bgTo: null, bgColor: null, link: null }));
  });

  it.each([null, ""])("preserves link=%j in stored API data", (link) => {
    const parsed = parseBannersBundle({ success: true, data: { carousel: [row({ link })] } });
    expect(parsed.carousel[0].link).toBe(link);
    expect(createCarouselBannerSchema.parse({ ...merchant, link }).link).toBe(link);
  });

  it("allows a two-stop gradient and partial updates without synthesizing other fields", () => {
    expect(createCarouselBannerSchema.parse({ ...merchant, bgVia: null }).bgVia).toBeNull();
    expect(updateCarouselBannerSchema.parse({ title: "Updated merchant title" })).toEqual({ title: "Updated merchant title" });
    expect(updateCarouselBannerSchema.parse({ bgVia: null, link: null })).toEqual({ bgVia: null, link: null });
  });

  it.each(["image", "title", "subtitle", "description", "badge"] as const)(
    "retains existing API validation for empty required %s", (field) => {
      expect(createCarouselBannerSchema.safeParse({ ...merchant, [field]: "" }).success).toBe(false);
      expect(updateCarouselBannerSchema.safeParse({ [field]: "" }).success).toBe(false);
    },
  );

  it("retains background-mode validation instead of silently inventing merchant colors", () => {
    expect(createCarouselBannerSchema.safeParse({ ...merchant, bgFrom: null }).success).toBe(false);
    expect(createCarouselBannerSchema.safeParse({ ...merchant, bgTo: null }).success).toBe(false);
    expect(createCarouselBannerSchema.safeParse({ ...merchant, bgType: "solid", bgColor: null }).success).toBe(false);
  });

  it("sends every supplied field on create/update and loads the returned saved values without a database", async () => {
    const validated = createCarouselBannerSchema.parse(merchant);
    const payload = {
      ...validated,
      bgFrom: validated.bgFrom ?? null,
      bgVia: validated.bgVia ?? null,
      bgTo: validated.bgTo ?? null,
      bgColor: validated.bgColor ?? null,
      link: validated.link ?? null,
    };
    const updated = { ...payload, title: "Merchant revised title", bgVia: null };
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ success: true, data: row(payload) }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ success: true, data: row(updated) }));
    vi.stubGlobal("fetch", fetch);

    const created = await createCarouselBanner(payload);
    const saved = await updateCarouselBanner(created.id, updated);

    expect(fetch).toHaveBeenNthCalledWith(1, "/api/admin/banners/carousel", expect.objectContaining({
      method: "POST", body: JSON.stringify(payload),
    }));
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/admin/banners/carousel/merchant-banner", expect.objectContaining({
      method: "PATCH", body: JSON.stringify(updated),
    }));
    expect(created).toEqual(row(payload));
    expect(saved).toEqual(row(updated));
    expect(buildCarouselForm(saved)).toMatchObject({
      title: updated.title,
      subtitle: merchant.subtitle,
      description: merchant.description,
      badge: merchant.badge,
      image: merchant.image,
      bgFrom: merchant.bgFrom,
      bgVia: "",
      bgTo: merchant.bgTo,
      link: merchant.link,
      position: "7",
      status: "INACTIVE",
    });
  });
});
