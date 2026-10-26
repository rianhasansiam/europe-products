
import { useInterfaceTranslations } from "@/components/i18n/translate";
import Link from "@/lib/i18n/navigation";
import { ChevronLeft, ShoppingBag, ShieldCheck, Truck } from "lucide-react";

type CartHeaderProps = {
  itemCount: number;
};

export default function CartHeader({ itemCount }: CartHeaderProps) {
  const i18n = useInterfaceTranslations("InterfaceCartComponentsCartHeader");
  return (
    <section className="relative hidden overflow-hidden rounded-2xl border border-border bg-secondary px-5 py-6 text-foreground shadow-sm sm:block sm:px-8 sm:py-8">
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link
            href="/products"
            className="inline-flex items-center gap-1 text-xs font-medium text-body transition-colors hover:text-primary"
          >
            <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
            {i18n("Continue shopping")}</Link>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-card text-primary ring-1 ring-border">
              <ShoppingBag className="h-6 w-6" />
            </span>
            {i18n("Your Cart")}{itemCount > 0 && (
              <span className="ms-1 rounded-full bg-card text-primary px-3 py-1 text-sm font-bold">
                {i18n("{count, plural, one {# item} other {# items}}", { count: itemCount })}
              </span>
            )}
          </h1>
          <p className="mt-2 max-w-md text-sm text-body">
            {i18n("Review your picks, apply a promo, and check out securely. We'll handle the rest.")}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:max-w-md sm:grid-cols-2">
          <Pill icon={<Truck className="h-4 w-4" />} label={i18n("Fast delivery")}>
            {i18n("2–5 day shipping")}</Pill>
          <Pill icon={<ShieldCheck className="h-4 w-4" />} label={i18n("Secure")}>
            {i18n("SSL encrypted checkout")}</Pill>
        </div>
      </div>
    </section>
  );
}

function Pill({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  const i18n = useInterfaceTranslations("InterfaceCartComponentsCartHeader");
  return (
    <div className="rounded-2xl border border-border bg-card/70 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-body">
        {icon}
        {i18n(label)}
      </div>
      <p className="mt-0.5 text-sm font-semibold">{children}</p>
    </div>
  );
}
