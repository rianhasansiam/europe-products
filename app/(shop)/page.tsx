import type { Metadata } from "next";

import CaroselBanner, {
  type CarouselSlide,
} from "./components/CarouselBanner";
import CategoryScroller from "./components/CategoryScroller";
import Categories from "./components/Categories";
import { getHomeCategories } from "@/lib/services/home-categories.service";
import { getActiveCarouselBanners } from "@/lib/services/banner.service";
import { getActiveCategoryTree } from "@/lib/services/category.service";
import { buildLocalizedMetadata } from "@/lib/seo/localized-metadata";
import { siteConfig } from "@/lib/seo/site";
import { getRequestLocale } from "@/lib/i18n/server";
import { localizeCategorySnapshots } from "@/lib/translations/public";
import PublicContentNotice from "@/components/i18n/PublicContentNotice";

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  return buildLocalizedMetadata({
  title: "Shop Industrial Automation, Electronics & More Online",
  description: siteConfig.description,
  path: "/",
  keywords: [
    "online shopping",
    "ecommerce store",
    "shop electronics",
    "fashion online",
    ...siteConfig.keywords,
  ],
}, "InterfacePage");
}

export default async function Home() {
  const [categories, carouselBanners, originalCategoryTree] = await Promise.all([
    getHomeCategories(),
    getActiveCarouselBanners(),
    getActiveCategoryTree(),
  ]);
  const categoryTree=await localizeCategorySnapshots(originalCategoryTree,await getRequestLocale());

  const slides: CarouselSlide[] = carouselBanners.map((banner) => ({
    id: banner.id,
    image: banner.image,
    title: banner.title,
    subtitle: banner.subtitle,
    description: banner.description,
    badge: banner.badge,
    bgType: banner.bgType,
    bgFrom: banner.bgFrom,
    bgVia: banner.bgVia,
    bgTo: banner.bgTo,
    bgColor: banner.bgColor,
    link: banner.link,
  }));

  return (
    <main>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
        <PublicContentNotice available={!categories.some(category=>!category.translationAvailable||category.products.some(product=>(product as {translationAvailable?:boolean}).translationAvailable===false))&&!carouselBanners.some(banner=>!banner.translationAvailable)}/>
        <CaroselBanner slides={slides} />
      </div>
      <div className="mx-auto max-w-7xl px-3 pb-8 sm:px-4 lg:px-6">
        <CategoryScroller categories={categoryTree} />
      </div>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pb-10">
        <Categories initialCategories={categories} />
      </div>
    </main>
  );
}
