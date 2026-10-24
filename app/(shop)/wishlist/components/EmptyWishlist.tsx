
import { useInterfaceTranslations } from "@/components/i18n/translate";
import Link from "@/lib/i18n/navigation";
import { Heart, Sparkles, ShoppingBag } from "lucide-react";

type EmptyWishlistProps = {
  /** When true, the empty state is the result of filtering, not a truly empty wishlist. */
  filtered?: boolean;
  onClearFilters?: () => void;
};

export default function EmptyWishlist({
  filtered = false,
  onClearFilters,
}: EmptyWishlistProps) {
  const i18n = useInterfaceTranslations("InterfaceWishlistComponentsEmptyWishlist");
  return (
    <div className="relative mx-auto mt-10 max-w-xl overflow-hidden rounded-3xl border border-brand-border bg-brand-white px-6 py-12 text-center shadow-sm sm:px-10 sm:py-16">
      <div className="pointer-events-none absolute -start-12 -top-12 h-40 w-40 rounded-full bg-brand-red/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -end-12 h-48 w-48 rounded-full bg-brand-red/10 blur-3xl" />

      <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-brand-red text-brand-white shadow-lg">
        <Heart className="h-9 w-9 fill-white" />
        <span className="absolute -end-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-brand-gold text-brand-black shadow">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
      </div>

      <h2 className="relative mt-6 text-xl font-bold text-gray-900 sm:text-2xl">
        {filtered ? i18n("No matches in your wishlist") : i18n("Your wishlist is empty")}
      </h2>
      <p className="relative mx-auto mt-2 max-w-sm text-sm text-gray-600">
        {filtered
          ? i18n("Try clearing filters or adjusting your search to find what you saved.")
          : i18n("Tap the heart on any product you love and we'll keep it safe right here, with price-drop alerts on the house.")}
      </p>

      <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
        {filtered ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-2 rounded-xl border border-brand-border bg-brand-white px-4 py-2.5 text-sm font-semibold text-brand-black transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-light-bg"
          >
            {i18n("Clear filters")}</button>
        ) : null}
        <Link
          href="/products"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-red px-5 py-2.5 text-sm font-semibold text-brand-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-md"
        >
          <ShoppingBag className="h-4 w-4" />
          {i18n("Discover products")}</Link>
      </div>
    </div>
  );
}
