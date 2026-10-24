"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import Link from "@/lib/i18n/navigation";

export default function LoginHeader() {
  const i18n = useInterfaceTranslations("InterfaceLoginComponentsLoginHeader");
  return (
    <header className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-brand-text-dark sm:text-3xl">
          {i18n.rich("Welcome <highlight>back</highlight>", { highlight: (chunks) => <span className="text-brand-red">{chunks}</span> })}
        </h2>

        <p className="mt-1 text-sm text-brand-text-muted">
          {i18n("New here?")}{" "}
          <Link
            href="/register"
            className="font-semibold text-brand-red underline-offset-2 hover:underline"
          >
            {i18n("Create an account")}</Link>
        </p>
      </div>
    </header>
  );
}
