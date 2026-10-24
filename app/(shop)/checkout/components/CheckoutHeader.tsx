
import { useInterfaceTranslations } from "@/components/i18n/translate";
import Link from "@/lib/i18n/navigation";
import { ChevronLeft, Lock, ShieldCheck, Truck } from "lucide-react";

type CheckoutHeaderProps = {
  isAuthenticated: boolean;
  itemCount: number;
  source: "cart" | "cart-selection" | "buy-now";
  loginHref: string;
};

export default function CheckoutHeader({
  isAuthenticated,
  itemCount,
  source,
  loginHref,
}: CheckoutHeaderProps) {
  const i18n = useInterfaceTranslations("InterfaceCheckoutComponentsCheckoutHeader");
  const backHref = source === "buy-now" ? "/products" : "/cart";
  const backLabel = source === "buy-now" ? "Continue shopping" : "Back to cart";

  return (
    <section className="relative overflow-hidden rounded-3xl border border-brand-border bg-brand-black px-5 py-6 text-brand-white shadow-lg sm:px-8 sm:py-8">
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
            href={backHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-white/80 transition-colors hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
            {backLabel}
          </Link>
          <h1 className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/30">
              <Lock className="h-6 w-6" />
            </span>
            {i18n("Checkout")}{itemCount > 0 && (
              <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold backdrop-blur-md sm:ms-1">
                {itemCount} {itemCount === 1 ? i18n("item") : i18n("items")}
              </span>
            )}
          </h1>
          <p className="mt-2 max-w-md text-sm text-white/85">
            {isAuthenticated
              ? i18n("We've prefilled your details. Review, pick a payment method, and place the order.")
              : i18n("Checkout as a guest. Fill in your delivery details to place your order.")}
          </p>
          {!isAuthenticated && (
            <p className="mt-3 text-xs text-white/85">
              {i18n("Already have an account?")}{" "}
              <Link
                href={loginHref}
                className="font-semibold text-white underline underline-offset-2 hover:text-white/80"
              >
                {i18n("Sign in (optional)")}</Link>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:max-w-md sm:grid-cols-2">
          <Pill icon={<Truck className="h-4 w-4" />} label={i18n("Fast delivery")}>
            {i18n("2-5 day shipping")}</Pill>
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
  const i18n = useInterfaceTranslations("InterfaceCheckoutComponentsCheckoutHeader");
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
