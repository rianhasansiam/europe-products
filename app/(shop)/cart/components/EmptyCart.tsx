
import { useInterfaceTranslations } from "@/components/i18n/translate";
import Link from "@/lib/i18n/navigation";
import { ShoppingBag, Sparkles, Heart } from "lucide-react";

export default function EmptyCart() {
  const i18n = useInterfaceTranslations("InterfaceCartComponentsEmptyCart");
  return (
    <div className="relative mx-auto mt-10 max-w-xl overflow-hidden rounded-3xl border border-brand-border bg-brand-white px-6 py-12 text-center shadow-sm sm:px-10 sm:py-16">
      <div className="pointer-events-none absolute -start-12 -top-12 h-40 w-40 rounded-full bg-brand-red/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -end-12 h-48 w-48 rounded-full bg-brand-red/5 blur-3xl" />

      <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-brand-red text-brand-white shadow-lg">
        <ShoppingBag className="h-9 w-9" />
        <span className="absolute -end-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-brand-gold text-brand-black shadow">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
      </div>

      <h2 className="relative mt-6 text-xl font-bold text-gray-900 sm:text-2xl">
        {i18n("Your cart is feeling lonely")}</h2>
      <p className="relative mx-auto mt-2 max-w-sm text-sm text-gray-600">
        {i18n("Browse the catalog and add a few favorites. Your wishlist is a great place to start.")}</p>

      <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/wishlist"
          className="inline-flex items-center gap-2 rounded-xl border border-brand-border bg-brand-white px-4 py-2.5 text-sm font-semibold text-brand-black transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-light-bg"
        >
          <Heart className="h-4 w-4" />
          {i18n("Open wishlist")}</Link>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-red px-5 py-2.5 text-sm font-semibold text-brand-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-md"
        >
          <ShoppingBag className="h-4 w-4" />
          {i18n("Start shopping")}</Link>
      </div>
    </div>
  );
}
