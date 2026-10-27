import { createElement } from "react";
import { describe, expect, it } from "vitest";

import CarouselBanner, {
  type CarouselSlide,
} from "@/app/(shop)/components/CarouselBanner";
import { renderToStaticMarkup } from "./helpers/intl";

const slide: CarouselSlide = {
  id: "merchant-slide",
  image: "/uploads/banners/merchant-original.webp",
  title: "The merchant's own headline",
  subtitle: "A separate merchant highlight",
  description: "Carefully chosen first line.\nThe merchant's second line.",
  badge: "A merchant badge",
  bgType: "gradient",
  bgFrom: "#112233",
  bgVia: "#445566",
  bgTo: "#778899",
  bgColor: null,
  link: "/products?campaign=merchant",
};

function renderSlide(overrides: Partial<CarouselSlide> = {}): string {
  return renderToStaticMarkup(
    createElement(CarouselBanner, { slides: [{ ...slide, ...overrides }] }),
  );
}

function anchors(markup: string): string[] {
  return markup.match(/<a\b[^>]*>[\s\S]*?<\/a>/g) ?? [];
}

function background(markup: string): string | undefined {
  return markup.match(/--hero-background:([^";]*)/)?.[1];
}

describe("homepage merchant hero", () => {
  it("renders the real merchant copy with a distinct highlighted subtitle and no duplicate badge", () => {
    const markup = renderSlide();
    const heading = markup.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1];

    expect(heading).toMatch(
      /^The merchant&#x27;s own headline <span\b[^>]*>A separate merchant highlight<\/span>$/,
    );
    expect(markup).toContain("Carefully chosen first line.\nThe merchant&#x27;s second line.");
    expect(markup.match(/A merchant badge/g)).toHaveLength(1);
    expect(markup.match(/The merchant&#x27;s own headline/g)).toHaveLength(1);
    expect(anchors(markup)).toHaveLength(2);
    expect(anchors(markup)[0]).toContain('href="/products?campaign=merchant"');
    expect(anchors(markup)[0]).toContain("Shop Now");
    expect(anchors(markup)[1]).toContain('href="/products"');
    expect(anchors(markup)[1]).toContain("View Offers");
  });

  it.each([
    ["#abc", "#abc"],
    ["#123456", "#123456"],
    ["#12345600", "#12345600"],
    ["bg-emerald-600", "#059669"],
  ])("honors solid %s independently of stored gradient values", (bgColor, expected) => {
    expect(background(renderSlide({ bgType: "solid", bgColor }))).toBe(expected);
  });

  it.each([
    [{ bgFrom: "#ff0000" }, "linear-gradient(to right, #ff0000, #445566, #778899)"],
    [{ bgVia: "#00ff00" }, "linear-gradient(to right, #112233, #00ff00, #778899)"],
    [{ bgTo: "#0000ff" }, "linear-gradient(to right, #112233, #445566, #0000ff)"],
    [{ bgFrom: "from-red-500" }, "linear-gradient(to right, #ef4444, #445566, #778899)"],
    [{ bgVia: "via-emerald-600" }, "linear-gradient(to right, #112233, #059669, #778899)"],
    [{ bgTo: "to-blue-700" }, "linear-gradient(to right, #112233, #445566, #1d4ed8)"],
  ])("preserves each gradient field independently: %j", (colors, expected) => {
    expect(background(renderSlide({ ...colors, bgColor: "#ff00ff" }))).toBe(expected);
  });

  it.each([null, ""])("keeps a two-color gradient when via=%s", (bgVia) => {
    expect(background(renderSlide({ bgVia }))).toBe(
      "linear-gradient(to right, #112233, #778899)",
    );
  });

  it("hides omitted badge, heading, and description without inserting replacement copy", () => {
    const markup = renderSlide({ badge: "", title: "", subtitle: "", description: "" });

    expect(markup).not.toMatch(/<h1\b|<p\b|<span\b/);
    expect(markup).not.toContain("A merchant badge");
    expect(markup).not.toContain("own headline");
    expect(markup).toContain('alt=""');
    expect(anchors(markup)).toHaveLength(2);
  });

  it("renders a subtitle-only heading without an empty title line", () => {
    const markup = renderSlide({ title: "", badge: "", description: "" });
    expect(markup).toMatch(/<h1\b[^>]*><span\b[^>]*>A separate merchant highlight<\/span><\/h1>/);
    expect(markup).not.toContain("<br");
  });

  it("renders a title-only heading without an empty highlight", () => {
    const markup = renderSlide({ subtitle: "", badge: "", description: "" });
    expect(markup).toMatch(/<h1\b[^>]*>The merchant&#x27;s own headline<\/h1>/);
    expect(markup).not.toContain("<span");
  });

  it("retains the original primary /products destination for a null link", () => {
    const links = anchors(renderSlide({ link: null }));
    expect(links).toHaveLength(2);
    expect(links.every((link) => link.includes('href="/products"'))).toBe(true);
    expect(links[0]).toContain("Shop Now");
  });

  it.each(["", "   "])("omits an explicitly empty primary link (%j) while retaining View Offers", (link) => {
    const links = anchors(renderSlide({ link }));
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('href="/products"');
    expect(links[0]).toContain("View Offers");
    expect(links[0]).not.toContain("Shop Now");
  });

  it.each(["", "   "])("keeps the merchant background and copy when image=%j", (image) => {
    const markup = renderSlide({ image, bgType: "solid", bgColor: "#123456" });
    expect(markup).toContain('data-has-image="false"');
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain('rel="preload"');
    expect(background(markup)).toBe("#123456");
    expect(markup).toContain("A separate merchant highlight");
  });

  it("renders nothing when there are no published slides", () => {
    expect(renderToStaticMarkup(createElement(CarouselBanner, { slides: [] }))).toBe("");
  });

  it("uses one real responsive image and preloads it once without single-slide controls", () => {
    const markup = renderSlide();
    expect(markup.match(/<img\b/g)).toHaveLength(1);
    expect(markup).toContain(encodeURIComponent(slide.image));
    expect(markup).toContain('alt="A separate merchant highlight"');
    expect(markup).toContain('sizes="(min-width: 100rem) 100rem, 100vw"');
    expect(markup.match(/<link\b[^>]*rel="preload"[^>]*as="image"/g)).toHaveLength(1);
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain('aria-roledescription="carousel"');
  });

  it("exposes multi-slide controls while rendering and preloading only the current image", () => {
    const second = {
      ...slide,
      id: "second-slide",
      image: "/uploads/banners/another-original.webp",
      title: "Another merchant headline",
      badge: "Another merchant badge",
    };
    const markup = renderToStaticMarkup(createElement(CarouselBanner, { slides: [slide, second] }));
    const buttons = markup.match(/<button\b[^>]*>/g) ?? [];

    expect(markup).toContain('aria-roledescription="carousel"');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toContain('aria-label="Show banner 1"');
    expect(buttons[0]).toContain('aria-current="true"');
    expect(buttons[1]).toContain('aria-label="Show banner 2"');
    expect(buttons[1]).not.toContain("aria-current");
    expect(markup.match(/<img\b/g)).toHaveLength(1);
    expect(markup.match(/<link\b[^>]*rel="preload"[^>]*as="image"/g)).toHaveLength(1);
    expect(markup).not.toContain("Another merchant headline");
    expect(markup).not.toContain(encodeURIComponent(second.image));
    // The server uses the safe reduced-motion snapshot; client motion controls
    // and rotation are exercised by the browser checks after hydration.
    expect(markup).not.toContain("Pause");
  });
});
