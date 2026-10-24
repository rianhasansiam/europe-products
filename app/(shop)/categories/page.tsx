
import { getInterfaceTranslations } from "@/components/i18n/server";
import type { Metadata } from "next";
import { ArrowRight, FolderTree } from "lucide-react";
import Image from "next/image";
import Link from "@/lib/i18n/navigation";

import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, collectionPageJsonLd } from "@/lib/seo/json-ld";
import { buildLocalizedMetadata } from "@/lib/seo/localized-metadata";
import { getActiveCategoryTree, type CategoryDto } from "@/lib/services/category.service";
import { getRequestLocale } from "@/lib/i18n/server";
import { localizeCategorySnapshots } from "@/lib/translations/public";
import PublicContentNotice from "@/components/i18n/PublicContentNotice";

export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  return buildLocalizedMetadata({
  title: "Shop All Categories",
  description:
    "Browse every active department and subcategory, then find the right products by brand, specification, price, and availability.",
  path: "/categories",
  keywords: ["product categories", "shop departments", "online catalog"],
}, "InterfaceCategoriesPage");
}

function DescendantLinks({ nodes }: { nodes: CategoryDto[] }) {
  if (nodes.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2 border-s border-brand-border ps-2 sm:ps-3">
      {nodes.map((node) => (
        <li key={node.id}>
          <Link
            href={`/categories/${node.path}`}
            className="group flex min-w-0 items-start justify-between gap-2 text-sm text-gray-700 hover:text-brand-red"
          >
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              {node.name}
            </span>
            <span className="shrink-0 text-xs text-gray-400 group-hover:text-brand-red">
              {node.totalProductCount}
            </span>
          </Link>
          <DescendantLinks nodes={node.children ?? []} />
        </li>
      ))}
    </ul>
  );
}

export default async function CategoryDirectoryPage() {
  const locale = await getRequestLocale();
  const i18n = await getInterfaceTranslations("InterfaceCategoriesPage");
  const roots = await localizeCategorySnapshots(await getActiveCategoryTree(), locale);
  const breadcrumb = breadcrumbJsonLd([
    { name: i18n("Home"), path: "/" },
    { name: i18n("Categories"), path: "/categories" },
  ], locale);
  const collection = collectionPageJsonLd({
    name: i18n("Product categories"),
    description: i18n("Complete category directory"),
    path: "/categories",
    locale,
  });

  return (
    <main className="min-h-screen bg-brand-light-bg">
      <JsonLd data={[breadcrumb, collection]} />
      <div className="mx-auto max-w-7xl px-3 py-8 sm:px-4 lg:px-6 lg:py-12">
        <PublicContentNotice available={!roots.some(category=>!category.translationAvailable)}/>
        <nav aria-label={i18n("Breadcrumb")} className="mb-5 text-sm text-gray-500">
          <Link href="/" className="hover:text-brand-red">{i18n("Home")}</Link>
          <span aria-hidden className="mx-2">/</span>
          <span aria-current="page" className="font-medium text-gray-800">
            {i18n("Categories")}</span>
        </nav>

        <header className="mb-8 max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-red">
            <FolderTree className="h-4 w-4" />
            {i18n("Complete directory")}</div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">
            {i18n("Shop by category")}</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600 sm:text-base">
            {i18n("Start with a department or follow the hierarchy to a more specific collection. Counts include products in every active descendant.")}</p>
        </header>

        {roots.length === 0 ? (
          <div className="rounded-2xl border border-brand-border bg-white p-10 text-center shadow-sm">
            <p className="font-semibold text-gray-900">{i18n("No categories are available yet.")}</p>
            <Link href="/products" className="mt-3 inline-flex text-sm font-semibold text-brand-red">
              {i18n("Browse all products")}</Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {roots.map((root) => (
              <article
                key={root.id}
                className="min-w-0 overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                {root.image ? (
                  <div className="relative aspect-[16/7] overflow-hidden bg-brand-light-bg">
                    <Image
                      src={root.image}
                      alt={i18n("{value0} category", { value0: root.name })}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition duration-500 hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[16/7] items-center justify-center bg-gradient-to-br from-brand-red/10 to-brand-light-bg">
                    <FolderTree className="h-10 w-10 text-brand-red/60" />
                  </div>
                )}
                <div className="p-5">
                  <Link
                    href={`/categories/${root.path}`}
                    className="group flex min-w-0 items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-extrabold text-gray-950 [overflow-wrap:anywhere] group-hover:text-brand-red">
                        {root.name}
                      </h2>
                      <p className="mt-1 text-xs text-gray-500">
                        {root.totalProductCount} {root.totalProductCount === 1 ? i18n("product") : i18n("products")}
                      </p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-brand-red transition group-hover:translate-x-1 rtl:rotate-180" />
                  </Link>
                  <DescendantLinks nodes={root.children ?? []} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
