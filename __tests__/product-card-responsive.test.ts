import { createElement } from "react";
import { renderToStaticMarkup } from "./helpers/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProductCard from "@/components/product/ProductCard";

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/auth/use-app-session", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
}));

vi.mock("react-redux", () => ({
  useDispatch: () => mocks.dispatch,
  useSelector: (
    selector: (state: { wishlist: { items: never[] } }) => unknown,
  ) => selector({ wishlist: { items: [] } }),
}));

function renderCard(variantCount = 1): string {
  return renderToStaticMarkup(
    createElement(ProductCard, {
      id: "product-1",
      slug: "test-product",
      name: "Test product with a useful descriptive name",
      price: 5_000,
      originalPrice: 5_500,
      image: "/test-product.jpg",
      rating: 4.5,
      reviewCount: 12,
      badge: "Popular",
      variantCount,
    }),
  );
}

function buttonTags(markup: string, ariaLabel: string): string[] {
  return (markup.match(/<button\b[^>]*>/g) ?? []).filter((tag) =>
    tag.includes(`aria-label="${ariaLabel}"`),
  );
}

function divWithClass(
  markup: string,
  className: string,
): { start: number; end: number; content: string } | null {
  for (const opening of markup.matchAll(/<div\b[^>]*>/g)) {
    const classes = opening[0].match(/\bclass="([^"]*)"/)?.[1].split(/\s+/);
    if (!classes?.includes(className)) continue;

    const contentStart = opening.index + opening[0].length;
    const tags = /<\/?div\b[^>]*>/g;
    tags.lastIndex = contentStart;
    let depth = 1;
    let tag: RegExpExecArray | null;

    while ((tag = tags.exec(markup)) !== null) {
      depth += tag[0].startsWith("</") ? -1 : 1;
      if (depth === 0) {
        return {
          start: opening.index,
          end: tags.lastIndex,
          content: markup.slice(contentStart, tag.index),
        };
      }
    }
    return null;
  }
  return null;
}

beforeEach(() => {
  mocks.dispatch.mockReset();
  mocks.push.mockReset();
});

describe("ProductCard responsive actions", () => {
  it("keeps mobile cart and wishlist actions below the product image", () => {
    const markup = renderCard();
    const cartButtons = buttonTags(markup, "Add to cart");
    const wishlistButtons = buttonTags(markup, "Add to wishlist");

    expect(cartButtons).toHaveLength(2);
    expect(wishlistButtons).toHaveLength(2);

    const desktopCartButton = cartButtons.find((tag) => tag.includes("absolute"));
    const desktopWishlistButton = wishlistButtons.find((tag) =>
      tag.includes("absolute"),
    );

    expect(desktopCartButton).toContain("hidden");
    expect(desktopCartButton).toContain("sm:can-hover:flex");
    // Desktop actions stay visible and retain an explicit keyboard focus ring.
    expect(desktopCartButton).not.toContain("opacity-0");
    expect(desktopCartButton).toContain("focus-visible:ring-2");
    expect(desktopWishlistButton).toContain("hidden");
    expect(desktopWishlistButton).toContain("sm:can-hover:flex");

    expect(markup).toContain(
      "border-border pt-3 sm:can-hover:hidden",
    );
    const imageContainer = divWithClass(markup, "aspect-4/3");
    const mobileActions = divWithClass(markup, "sm:can-hover:hidden");

    expect(imageContainer).not.toBeNull();
    expect(mobileActions).not.toBeNull();
    expect(mobileActions!.start).toBeGreaterThanOrEqual(imageContainer!.end);
    expect(buttonTags(mobileActions!.content, "Add to cart")).toHaveLength(1);
    expect(buttonTags(mobileActions!.content, "Add to wishlist")).toHaveLength(1);

    // Touch actions use a 44px minimum target and allow the cart label to fill
    // the remaining space beside the wishlist control.
    expect(
      cartButtons.some(
        (tag) =>
          !tag.includes("absolute") &&
          tag.includes("min-h-11") &&
          tag.includes("flex-1") &&
          tag.includes("text-xs"),
      ),
    ).toBe(true);
    expect(
      wishlistButtons.some(
        (tag) =>
          !tag.includes("absolute") &&
          tag.includes("min-h-11") &&
          tag.includes("w-11"),
      ),
    ).toBe(true);
  });

  it("uses the option-selection action for multi-variant products", () => {
    const markup = renderCard(2);
    const optionButtons = buttonTags(markup, "Select product options");

    expect(optionButtons).toHaveLength(2);
    expect(markup).toContain("Options");
    expect(markup).not.toContain('aria-label="Add to cart"');
  });
});
