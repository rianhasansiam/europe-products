
import { useInterfaceTranslations } from "@/components/i18n/translate";
import { Fragment } from "react";
import { ChevronRight, Home } from "lucide-react";
import Link from "@/lib/i18n/navigation";

const Breadcrumbs = ({
  items,
}: {
  items: { label: string; href?: string }[];
}) => {
  const i18n = useInterfaceTranslations("InterfaceProductsSlugComponentsBreadcrumbs");
  return (
    <div className="flex min-w-0 flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Breadcrumb Navigation */}
      <nav
        aria-label={i18n("Breadcrumb")}
        className="flex w-full min-w-0 max-w-full items-center gap-2 overflow-x-auto overscroll-x-contain text-sm"
      >
        <Link
          href="/"
          aria-label={i18n("Home")}
          className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors shrink-0"
        >
          <Home className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">{i18n("Home")}</span>
        </Link>
        {items.map((item, index) => (
          <Fragment key={index}>
            <ChevronRight className="w-4 h-4 text-border shrink-0 rtl:rotate-180" />
            {item.href ? (
              <Link
                href={item.href}
                className="text-muted-foreground hover:text-primary transition-colors shrink-0"
              >
                {item.label}
              </Link>
            ) : (
              <span className="min-w-0 truncate font-medium text-foreground">
                {item.label}
              </span>
            )}
          </Fragment>
        ))}
      </nav>
    </div>
  );
};

export default Breadcrumbs;
