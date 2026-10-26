
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
    <section className="relative overflow-hidden rounded-2xl border border-border bg-secondary px-5 py-6 text-foreground shadow-sm sm:px-8 sm:py-8">
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-body transition-colors hover:text-primary"
          >
            <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
            {backLabel}
          </Link>
          <h1 className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-card text-primary ring-1 ring-border">
              <Lock className="h-6 w-6" />
            </span>
            {i18n("Checkout")}{itemCount > 0 && (
              <span className="rounded-full bg-card text-primary px-3 py-1 text-sm font-bold sm:ms-1">
                {itemCount} {itemCount === 1 ? i18n("item") : i18n("items")}
              </span>
            )}
          </h1>
          <p className="mt-2 max-w-md text-sm text-body">
            {isAuthenticated
              ? i18n("We've prefilled your details. Review, pick a payment method, and place the order.")
              : i18n("Checkout as a guest. Fill in your delivery details to place your order.")}
          </p>
          {!isAuthenticated && (
            <p className="mt-3 text-xs text-body">
              {i18n("Already have an account?")}{" "}
              <Link
                href={loginHref}
                className="font-semibold text-primary underline underline-offset-2 hover:text-body"
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
    <div className="rounded-2xl border border-border bg-card/70 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-body">
        {icon}
        {i18n(label)}
      </div>
      <p className="mt-0.5 text-sm font-semibold">{children}</p>
    </div>
  );
}
