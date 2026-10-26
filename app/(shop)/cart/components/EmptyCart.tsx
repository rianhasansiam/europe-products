
import { useInterfaceTranslations } from "@/components/i18n/translate";
import Link from "@/lib/i18n/navigation";
import { ShoppingBag, Sparkles, Heart } from "lucide-react";

export default function EmptyCart() {
  const i18n = useInterfaceTranslations("InterfaceCartComponentsEmptyCart");
  return (
    <div className="relative mx-auto mt-10 max-w-xl overflow-hidden rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-sm sm:px-10 sm:py-16">

      <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
        <ShoppingBag className="h-9 w-9" />
        <span className="absolute -end-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-secondary text-primary shadow">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
      </div>

      <h2 className="relative mt-6 text-xl font-bold text-foreground sm:text-2xl">
        {i18n("Your cart is feeling lonely")}</h2>
      <p className="relative mx-auto mt-2 max-w-sm text-sm text-body">
        {i18n("Browse the catalog and add a few favorites. Your wishlist is a great place to start.")}</p>

      <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/wishlist"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-muted"
        >
          <Heart className="h-4 w-4" />
          {i18n("Open wishlist")}</Link>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors duration-200 hover:bg-primary-hover"
        >
          <ShoppingBag className="h-4 w-4" />
          {i18n("Start shopping")}</Link>
      </div>
    </div>
  );
}
