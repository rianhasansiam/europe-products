
import { useInterfaceTranslations } from "@/components/i18n/translate";
import Link from "@/lib/i18n/navigation";
import { ChevronLeft, ShoppingBag, ShieldCheck, Truck } from "lucide-react";

type CartHeaderProps = {
  itemCount: number;
};

export default function CartHeader({ itemCount }: CartHeaderProps) {
  const i18n = useInterfaceTranslations("InterfaceCartComponentsCartHeader");
  return (
    <section className="relative hidden overflow-hidden rounded-3xl border border-brand-border bg-brand-black px-5 py-6 text-brand-white shadow-lg sm:block sm:px-8 sm:py-8">
      <div className="pointer-events-none absolute -end-12 -top-16 h-48 w-48 rounded-full bg-brand-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -start-10 h-56 w-56 rounded-full bg-brand-red/20 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link
            href="/products"
            className="inline-flex items-center gap-1 text-xs font-medium text-white/80 transition-colors hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
            {i18n("Continue shopping")}</Link>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/30">
              <ShoppingBag className="h-6 w-6" />
            </span>
            {i18n("Your Cart")}{itemCount > 0 && (
              <span className="ms-1 rounded-full bg-white/20 px-3 py-1 text-sm font-bold backdrop-blur-md">
                {i18n("{count, plural, one {# item} other {# items}}", { count: itemCount })}
              </span>
            )}
          </h1>
          <p className="mt-2 max-w-md text-sm text-white/85">
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
    <div className="rounded-2xl border border-white/25 bg-white/12 px-3 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-1.5 text-xs font-medium text-white/80">
        {icon}
        {i18n(label)}
      </div>
      <p className="mt-0.5 text-sm font-semibold">{children}</p>
    </div>
  );
}
