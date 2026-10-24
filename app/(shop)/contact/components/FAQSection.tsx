"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useState } from "react";
import { HelpCircle, Plus, Minus } from "lucide-react";

const faqs = [
  {
    q: "How fast does SexToy deliver?",
    a: "Most orders from local stores within 50km arrive the same day. You'll see the estimated delivery window on the product page before checkout.",
  },
  {
    q: "What's the return policy?",
    a: "We offer a hassle-free 7-day return window on most products. Some categories like groceries and personal care may have different rules, clearly listed on the product page.",
  },
  {
    q: "Are all stores verified?",
    a: "Yes. Every merchant on SexToy is hand-picked and goes through identity, address, and quality verification before listing.",
  },
  {
    q: "How do I track my order?",
    a: "Once your order is placed, you'll get real-time tracking updates via SMS, email, and the SexToy app. You can also track from your profile under My Orders.",
  },
  {
    q: "How do I become a seller?",
    a: "We'd love to have you. Use the contact form above with subject 'Partnership / Sell on SexToy' and our merchant team will reach out within 24 hours.",
  },
  {
    q: "Do you offer customer support on weekends?",
    a: "You can contact our support team using the message form or email.",
  },
];

export default function FAQSection() {
  const i18n = useInterfaceTranslations("InterfaceContactComponentsFAQSection");
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section>
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-light-bg px-3 py-1.5">
          <HelpCircle className="h-3.5 w-3.5 text-brand-red" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-brand-red">
            {i18n("Got Questions?")}</span>
        </div>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-foreground sm:text-3xl lg:text-4xl">
          {i18n.rich("Frequently asked <highlight>questions</highlight>", { highlight: (chunks) => <span className="text-brand-red">{chunks}</span> })}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
          {i18n("Quick answers to common questions. Don't see yours? Send us a message above.")}</p>
      </div>

      <div className="mx-auto max-w-3xl space-y-3">
        {faqs.map((item, i) => {
          const isOpen = open === i;
          return (
            <div
              key={i18n(item.q)}
              className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition-all duration-300 ${
                isOpen
                  ? "ring-brand-red shadow-md"
                  : "ring-brand-border hover:ring-brand-red/40"
              }`}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start"
              >
                <span className="text-sm font-bold text-foreground sm:text-base">
                  {i18n(item.q)}
                </span>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                    isOpen
                      ? "bg-brand-red text-white rotate-180"
                      : "bg-brand-light-bg text-brand-red"
                  }`}
                >
                  {isOpen ? (
                    <Minus className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </span>
              </button>

              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  isOpen
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                    {i18n(item.a)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
