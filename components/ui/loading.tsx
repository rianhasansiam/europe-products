
import { useInterfaceTranslations } from "@/components/i18n/translate";
import { Loader2 } from "lucide-react";
import type React from "react";

import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/seo/site";

type LoadingSpinnerProps = {
  className?: string;
  label?: string;
  decorative?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
};

const SPINNER_SIZE: Record<NonNullable<LoadingSpinnerProps["size"]>, string> = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

export function LoadingSpinner({
  className,
  label = "Loading",
  decorative = false,
  size = "md",
}: LoadingSpinnerProps) {
  const i18n = useInterfaceTranslations("InterfaceUiLoading");
  return (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      role={decorative ? undefined : "status"}
      aria-live={decorative ? undefined : "polite"}
      aria-label={decorative ? undefined : i18n(label)}
    >
      <Loader2
        aria-hidden="true"
        className={cn("motion-safe:animate-spin", SPINNER_SIZE[size])}
      />
      {!decorative && <span className="sr-only">{i18n(label)}</span>}
    </span>
  );
}

export function ButtonLoader({
  label,
  className,
}: {
  label?: React.ReactNode;
  className?: string;
}) {
  const i18n = useInterfaceTranslations("InterfaceUiLoading");
  return (
    <span className={cn("inline-flex items-center justify-center gap-2", className)}>
      <LoadingSpinner decorative size="sm" />
      {label && <span>{typeof label === "string" ? i18n(label) : label}</span>}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("motion-safe:animate-pulse rounded-lg bg-border/65", className)}
    />
  );
}

export function CardSkeleton({
  className,
  media = true,
  lines = 3,
}: {
  className?: string;
  media?: boolean;
  lines?: number;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-brand-border bg-brand-white p-3 shadow-sm",
        className,
      )}
      aria-hidden="true"
    >
      {media && <Skeleton className="aspect-4/3 w-full rounded-xl" />}
      <div className={cn("space-y-2", media ? "mt-3" : "")}>
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton
            key={index}
            className={cn(
              "h-3",
              index === 0 ? "w-4/5" : index === lines - 1 ? "w-1/2" : "w-full",
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        className,
      )}
      aria-hidden="true"
    >
      <Skeleton className="aspect-4/3 w-full rounded-none" />
      <div className="flex flex-1 flex-col space-y-3 p-3 sm:p-3.5">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <div className="mt-auto flex items-center gap-2">
          <Skeleton className="h-4 w-16 min-[360px]:w-20" />
          <Skeleton className="h-3 w-10 min-[360px]:w-12" />
        </div>
        <div className="flex items-center justify-center gap-1.5 border-t border-brand-border/70 pt-2 sm:can-hover:hidden">
          <Skeleton className="h-10 min-w-0 max-w-24 flex-1 rounded-lg" />
          <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({
  rows = 6,
  columns = 5,
  className,
  ariaLabel = "Loading table",
}: {
  rows?: number;
  columns?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const i18n = useInterfaceTranslations("InterfaceUiLoading");
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-brand-border bg-brand-white shadow-sm",
        className,
      )}
      aria-busy="true"
      aria-label={i18n(ariaLabel)}
      role="status"
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-brand-light-bg">
            <tr>
              {Array.from({ length: columns }).map((_, index) => (
                <th key={index} className="px-4 py-3">
                  <Skeleton className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, row) => (
              <tr key={row} className="border-t border-brand-border">
                {Array.from({ length: columns }).map((_, column) => (
                  <td key={column} className="px-4 py-3">
                    <Skeleton
                      className={cn(
                        "h-4",
                        column === 0 ? "w-36" : column === columns - 1 ? "w-24" : "w-20",
                      )}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <span className="sr-only">{i18n(ariaLabel)}</span>
    </div>
  );
}

export function SectionLoader({
  title = "Loading section",
  rows = 3,
  className,
}: {
  title?: string;
  rows?: number;
  className?: string;
}) {
  const i18n = useInterfaceTranslations("InterfaceUiLoading");
  return (
    <section
      className={cn(
        "rounded-2xl border border-brand-border bg-brand-white p-5 shadow-sm",
        className,
      )}
      aria-busy="true"
      aria-label={i18n(title)}
      role="status"
    >
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-brand-red">
        <LoadingSpinner decorative size="sm" />
        <span>{i18n(title)}</span>
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton
            key={index}
            className={cn("h-4", index === rows - 1 ? "w-2/3" : "w-full")}
          />
        ))}
      </div>
    </section>
  );
}

export function PageLoader({
  title = "Loading...",
  message = "Preparing your page...",
  className,
}: {
  title?: string;
  message?: string;
  className?: string;
}) {
  const i18n = useInterfaceTranslations("InterfaceUiLoading");
  return (
    <div
      className={cn(
        "flex min-h-[55vh] items-center justify-center bg-brand-light-bg px-4 py-12",
        className,
      )}
      aria-busy="true"
      role="status"
    >
      <div className="w-full max-w-sm rounded-3xl border border-brand-border bg-brand-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary">
          <span className="text-lg font-bold leading-none">
            P<span className="text-brand-red">H</span>
          </span>
        </div>
        <LoadingSpinner size="lg" className="text-brand-red" label={i18n(title)} />
        <p className="mt-5 text-lg font-extrabold text-brand-black">{i18n(title)}</p>
        <p className="mt-1 text-sm text-brand-text-muted">{i18n(message)}</p>
      </div>
    </div>
  );
}

export function FullPageLoader({
  title = "Loading...",
  message = "Please wait...",
}: {
  title?: string;
  message?: string;
}) {
  const i18n = useInterfaceTranslations("InterfaceUiLoading");
  return (
    <main className="min-h-screen bg-brand-light-bg">
      <PageLoader title={i18n(title)} message={i18n(message)} className="min-h-screen" />
    </main>
  );
}

export function LoadingPage(props: React.ComponentProps<typeof FullPageLoader>) {
  return <FullPageLoader {...props} />;
}

export function ProductGridSkeleton({
  count = 12,
  wide = false,
}: {
  count?: number;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-3",
        wide ? "lg:grid-cols-4 xl:grid-cols-5" : "lg:grid-cols-3 xl:grid-cols-4",
      )}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function ProductsPageSkeleton() {
  return (
    <main className="min-h-screen bg-brand-light-bg" aria-busy="true">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
        <div className="flex gap-5">
          <aside className="hidden w-64 shrink-0 lg:block" aria-hidden="true">
            <div className="rounded-2xl border border-brand-border bg-brand-white p-4 shadow-sm">
              <Skeleton className="h-5 w-28" />
              <div className="mt-5 space-y-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ))}
              </div>
            </div>
          </aside>
          <section className="min-w-0 flex-1">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-border bg-brand-white p-3 shadow-sm">
              <Skeleton className="h-5 w-40" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-20" />
              </div>
            </div>
            <ProductGridSkeleton />
          </section>
        </div>
      </div>
    </main>
  );
}

export function CategoryPageSkeleton() {
  return (
    <main className="min-h-screen bg-brand-light-bg" aria-busy="true">
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <Skeleton className="mb-5 h-4 w-56" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-3 h-4 w-full max-w-xl" />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </main>
  );
}

export function ProductDetailsPageSkeleton() {
  const i18n = useInterfaceTranslations("InterfaceUiLoading");
  return (
    <main className="min-h-screen bg-brand-light-bg" aria-busy="true">
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 lg:px-6">
        <Skeleton className="h-4 w-56" />
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-12">
          <section className="md:col-span-6 lg:col-span-4">
            <Skeleton className="aspect-square w-full rounded-2xl" />
            <div className="mt-3 grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="aspect-square rounded-xl" />
              ))}
            </div>
          </section>
          <section className="md:col-span-6 lg:col-span-5">
            <div className="rounded-2xl border border-brand-border bg-brand-white p-5">
              <Skeleton className="h-8 w-4/5" />
              <Skeleton className="mt-3 h-4 w-40" />
              <Skeleton className="mt-6 h-9 w-44" />
              <div className="mt-6 space-y-5">
                <Skeleton className="h-5 w-24" />
                <div className="flex gap-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-16 rounded-xl" />
                  ))}
                </div>
                <Skeleton className="h-11 w-40 rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            </div>
          </section>
          <aside className="md:col-span-12 lg:col-span-3">
            <div className="space-y-3 rounded-2xl border border-brand-border bg-brand-white p-4">
              <Skeleton className="h-5 w-32" />
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex gap-3">
                  <Skeleton className="h-16 w-16 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          <SectionLoader title={i18n("Loading product details")} rows={4} className="lg:col-span-2" />
          <SectionLoader title={i18n("Loading offers")} rows={4} />
        </div>
      </div>
    </main>
  );
}

export function CartPageSkeleton() {
  const i18n = useInterfaceTranslations("InterfaceUiLoading");
  return (
    <main className="min-h-screen bg-brand-light-bg" aria-busy="true">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Skeleton className="h-9 w-56" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="space-y-3">
            <Skeleton className="h-16 w-full rounded-2xl" />
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="flex gap-4 rounded-2xl border border-brand-border bg-brand-white p-4 shadow-sm"
              >
                <Skeleton className="h-28 w-28 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-8 w-36" />
                </div>
              </div>
            ))}
          </section>
          <SectionLoader title={i18n("Loading order summary")} rows={6} />
        </div>
      </div>
    </main>
  );
}

export function CheckoutPageSkeleton() {
  const i18n = useInterfaceTranslations("InterfaceUiLoading");
  return (
    <main className="min-h-screen bg-brand-light-bg" aria-busy="true">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Skeleton className="h-9 w-56" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <section className="space-y-5">
            <SectionLoader title={i18n("Loading customer details")} rows={5} />
            <SectionLoader title={i18n("Loading payment options")} rows={3} />
            <SectionLoader title={i18n("Loading checkout items")} rows={4} />
          </section>
          <SectionLoader title={i18n("Calculating totals")} rows={7} />
        </div>
      </div>
    </main>
  );
}

export function ProfilePageSkeleton() {
  const i18n = useInterfaceTranslations("InterfaceUiLoading");
  return (
    <main className="min-h-screen bg-brand-light-bg" aria-busy="true">
      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-8 lg:py-10">
        <div className="rounded-3xl border border-brand-border bg-brand-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-7 w-full max-w-48" />
              <Skeleton className="h-4 w-full max-w-64" />
            </div>
          </div>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="space-y-2 rounded-2xl border border-brand-border bg-brand-white p-3">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full rounded-xl" />
            ))}
          </div>
          <SectionLoader title={i18n("Loading your profile")} rows={7} />
        </div>
      </div>
    </main>
  );
}

export function WishlistPageSkeleton() {
  return (
    <main className="min-h-screen bg-brand-light-bg" aria-busy="true">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="rounded-3xl border border-brand-border bg-brand-white p-6 shadow-sm">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-3 h-4 w-full max-w-xl" />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <CardSkeleton key={index} lines={4} />
          ))}
        </div>
      </div>
    </main>
  );
}

export function OrderDetailsPageSkeleton() {
  const i18n = useInterfaceTranslations("InterfaceUiLoading");
  return (
    <main className="min-h-screen bg-brand-light-bg" aria-busy="true">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <Skeleton className="h-8 w-64" />
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-4">
            <SectionLoader title={i18n("Loading order progress")} rows={4} />
            <TableSkeleton rows={4} columns={4} ariaLabel={i18n("Loading order items")} />
          </section>
          <SectionLoader title={i18n("Loading receipt")} rows={7} />
        </div>
      </div>
    </main>
  );
}

export function AuthPageSkeleton() {
  return (
    <main className="relative min-h-screen bg-brand-light-bg" aria-busy="true">
      <section className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:py-12">
        <div className="hidden rounded-3xl border border-brand-border bg-secondary p-8 lg:col-span-5 lg:block">
          <Skeleton className="h-6 w-36 bg-border" />
          <Skeleton className="mt-8 h-14 w-full bg-border" />
          <Skeleton className="mt-4 h-4 w-4/5 bg-border" />
          <div className="mt-10 grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-20 bg-border" />
            ))}
          </div>
        </div>
        <div className="lg:col-span-7">
          <div className="rounded-3xl border border-brand-border bg-brand-white p-6 shadow-xl sm:p-9">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-3 h-4 w-64" />
            <div className="mt-8 space-y-4">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-full" />
              <Skeleton className="h-12 w-full rounded-full" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export function AdminDashboardSkeleton() {
  const i18n = useInterfaceTranslations("InterfaceUiLoading");
  return (
    <section className="space-y-5" aria-busy="true">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Skeleton className="h-7 w-36" />
          <Skeleton className="mt-2 h-3 w-56" />
        </div>
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <CardSkeleton key={index} media={false} lines={3} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <SectionLoader title={i18n("Loading sales chart")} rows={8} className="xl:col-span-2" />
        <SectionLoader title={i18n("Loading top products")} rows={8} />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <TableSkeleton rows={5} columns={4} className="xl:col-span-2" />
        <SectionLoader title={i18n("Loading activity")} rows={6} />
      </div>
    </section>
  );
}

export function AdminTablePageSkeleton({
  title = "Loading admin data",
  columns = 6,
}: {
  title?: string;
  columns?: number;
}) {
  const i18n = useInterfaceTranslations("InterfaceUiLoading");
  return (
    <section className="space-y-4" aria-busy="true">
      <div className="rounded-2xl border border-brand-border bg-brand-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Skeleton className="h-6 w-44" />
            <Skeleton className="mt-2 h-3 w-60" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="h-9 w-24 rounded-xl" />
          </div>
        </div>
      </div>
      <TableSkeleton rows={7} columns={columns} ariaLabel={i18n(title)} />
    </section>
  );
}

export function HomePageSkeleton() {
  return (
    <main className="bg-brand-light-bg" aria-busy="true">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 lg:px-6">
        <div className="overflow-hidden rounded-3xl border border-brand-border bg-brand-white p-5 shadow-sm">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="mt-4 h-12 w-full max-w-2xl" />
          <Skeleton className="mt-8 aspect-[16/6] w-full rounded-2xl" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-3 pb-10 sm:px-4 lg:px-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <CardSkeleton key={index} lines={2} />
          ))}
        </div>
      </div>
    </main>
  );
}

export function BrandLoadingText({
  text = `Preparing ${siteConfig.name}...`,
}: {
  text?: string;
}) {
  const i18n = useInterfaceTranslations("InterfaceUiLoading");
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-red">
      <LoadingSpinner decorative size="sm" />
      {i18n(text)}
    </span>
  );
}
