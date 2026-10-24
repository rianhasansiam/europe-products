
import { useInterfaceTranslations } from "@/components/i18n/translate";
import { ArrowRight, FolderTree } from "lucide-react";
import Image from "next/image";
import Link from "@/lib/i18n/navigation";

import type { CategoryDto } from "@/lib/services/category.service";

function findCategoryByName(
  nodes: readonly CategoryDto[],
  name: string,
): CategoryDto | null {
  for (const node of nodes) {
    if (node.name.localeCompare(name, undefined, { sensitivity: "base" }) === 0) {
      return node;
    }

    const match = findCategoryByName(node.children ?? [], name);
    if (match) return match;
  }

  return null;
}

export default function CategoryScroller({
  categories,
}: {
  categories: CategoryDto[];
}) {
  const i18n = useInterfaceTranslations("InterfaceComponentsCategoryScroller");
  if (categories.length === 0) return null;

  const bags = findCategoryByName(categories, "Bags");
  const visibleCategories =
    bags && !categories.some((category) => category.id === bags.id)
      ? [...categories, bags]
      : categories;

  return (
    <section
      aria-labelledby="home-category-scroller-title"
      className="overflow-hidden rounded-2xl  bg-brand-white py-2  sm:py-3"
    >
      <div className="mb-1 flex items-end justify-between gap-3 px-3 sm:px-6">
        <div className="min-w-0">
          <h2
            id="home-category-scroller-title"
            className="text-lg font-black text-gray-950 sm:text-xl"
          >
            {i18n("All categories")}</h2>
          {/* <p className="mt-1 text-xs text-brand-text-muted sm:text-sm">
            Swipe or scroll to explore the complete catalog.
          </p> */}
        </div>

        <Link
          href="/categories"
          className="group hidden shrink-0 items-center gap-1 text-sm font-semibold text-brand-red transition-colors hover:text-brand-red-hover sm:flex"
        >
          {i18n("View all")}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
        </Link>
      </div>

      <nav
        aria-label={i18n("All product categories")}
        className="snap-x snap-proximity overflow-x-auto overscroll-x-contain pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="mx-auto flex w-max min-w-full justify-center gap-4 px-2 pt-2  sm:gap-5">
          {visibleCategories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.path}`}
              title={category.name}
              className="group flex w-24 shrink-0 snap-start flex-col items-center text-center sm:w-28"
            >
              <span className="relative flex size-20 items-center justify-center overflow-hidden rounded-full border-2 border-brand-border bg-brand-light-bg shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:border-brand-red/50 group-hover:shadow-md sm:size-24">
                {category.image ? (
                  <Image
                    src={category.image}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 96px, 80px"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <FolderTree
                    aria-hidden="true"
                    className="h-8 w-8 text-brand-red/60 sm:h-9 sm:w-9"
                  />
                )}
              </span>

              <span className="mt-2 line-clamp-2 min-h-9 w-full text-xs font-bold leading-4 text-gray-800 [overflow-wrap:anywhere] transition-colors group-hover:text-brand-red sm:text-sm sm:leading-[1.125rem]">
                {category.name}
              </span>
              <span
                title={`${category.totalProductCount} ${category.totalProductCount === 1 ? i18n("product") : i18n("products")}`}
                className="mt-0.5 w-full truncate text-[10px] text-brand-text-muted sm:text-xs"
              >
                {category.totalProductCount}{" "}
                {category.totalProductCount === 1 ? i18n("product") : i18n("products")}
              </span>
            </Link>
          ))}

          <Link
            href="/categories"
            title={i18n("Browse all categories")}
            className="group flex w-24 shrink-0 snap-start flex-col items-center text-center sm:w-28"
          >
            <span className="relative flex size-20 items-center justify-center overflow-hidden rounded-full border-2 border-brand-border bg-brand-light-bg shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:border-brand-red/50 group-hover:shadow-md sm:size-24">
              <FolderTree
                aria-hidden="true"
                className="h-8 w-8 text-brand-red sm:h-9 sm:w-9"
              />
            </span>
            <span className="mt-2 min-h-9 text-xs font-bold leading-4 text-gray-800 transition-colors group-hover:text-brand-red sm:text-sm sm:leading-[1.125rem]">
              {i18n("Others")}</span>
            <span className="mt-0.5 text-[10px] text-brand-text-muted sm:text-xs">
              {i18n("View all")}</span>
          </Link>
        </div>
      </nav>
    </section>
  );
}
