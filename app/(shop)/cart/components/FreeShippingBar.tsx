
import { useInterfaceTranslations } from "@/components/i18n/translate";
import { Truck, PartyPopper } from "lucide-react";

import { CurrencyAmount } from "@/components/currency/CurrencyAmount";

type FreeShippingBarProps = {
  subtotalUSD: number;
  thresholdUSD: number;
};

export default function FreeShippingBar({
  subtotalUSD,
  thresholdUSD,
}: FreeShippingBarProps) {
  const i18n = useInterfaceTranslations("InterfaceCartComponentsFreeShippingBar");
  const remainingUSD = Math.max(0, thresholdUSD - subtotalUSD);
  const progress = Math.min(100, (subtotalUSD / thresholdUSD) * 100);
  const reached = remainingUSD === 0;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border px-4 py-3.5 transition-colors duration-300 ${
        reached
          ? "border-emerald-200 bg-emerald-50"
          : "border-brand-border bg-brand-white"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white ${
            reached
              ? "bg-emerald-500"
              : "bg-brand-red"
          }`}
        >
          {reached ? (
            <PartyPopper className="h-4 w-4" />
          ) : (
            <Truck className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          {reached ? (
            <p className="text-sm font-semibold text-emerald-800">
              {i18n("You've unlocked free shipping")}</p>
          ) : (
            <p className="text-sm font-semibold text-gray-800">
              {i18n("Add")}{" "}
              <span className="text-brand-red">
                <CurrencyAmount amountUSD={remainingUSD} />
              </span>{" "}
              {i18n("more for free shipping")}</p>
          )}
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                reached
                  ? "bg-emerald-500"
                  : "bg-brand-red"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
