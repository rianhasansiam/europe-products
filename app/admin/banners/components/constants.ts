import type {
  BannerKind,
  BannerStatus,
  CarouselBannerRow,
  CategoryBannerRow,
  DealBannerRow,
  PromoBannerRow,
  TopBannerRow,
} from "@/features/admin-banners/api";

export const STATUS_BADGE: Record<BannerStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  INACTIVE: "bg-amber-50 text-amber-700 ring-amber-200",
};

export const TABS: { kind: BannerKind; label: string; description: string }[] = [
  {
    kind: "carousel",
    label: "Hero carousel",
    description: "Rotating slides on the home page hero.",
  },
  {
    kind: "category",
    label: "Category banners",
    description: "Side rail attached to a category strip on the home page.",
  },
  {
    kind: "top",
    label: "Top strip",
    description: "Thin promotional strip pinned to the top of the site.",
  },
  {
    kind: "deal",
    label: "Product deals",
    description: "Horizontal deal carousel on the product-details page.",
  },
  {
    kind: "promo",
    label: "Product promos",
    description: "Tall side-rail promo banners on the product-details page.",
  },
];

export type EditingState =
  | { mode: "create"; kind: BannerKind }
  | { mode: "edit"; kind: "carousel"; banner: CarouselBannerRow }
  | { mode: "edit"; kind: "category"; banner: CategoryBannerRow }
  | { mode: "edit"; kind: "top"; banner: TopBannerRow }
  | { mode: "edit"; kind: "deal"; banner: DealBannerRow }
  | { mode: "edit"; kind: "promo"; banner: PromoBannerRow }
  | null;
