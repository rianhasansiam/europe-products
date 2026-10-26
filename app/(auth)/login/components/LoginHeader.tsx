"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import Link from "@/lib/i18n/navigation";

export default function LoginHeader() {
  const i18n = useInterfaceTranslations("InterfaceLoginComponentsLoginHeader");
  return (
    <header className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {i18n.rich("Welcome <highlight>back</highlight>", { highlight: (chunks) => <span className="text-primary">{chunks}</span> })}
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          {i18n("New here?")}{" "}
          <Link
            href="/register"
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            {i18n("Create an account")}</Link>
        </p>
      </div>
    </header>
  );
}
