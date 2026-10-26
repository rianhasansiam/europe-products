"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CatalogFacets } from "@/features/products/api";

import FilterSidebar, { type CatalogFilterState } from "./FilterSidebar";

type Props = {
  open: boolean;
  onClose: () => void;
  filters: CatalogFilterState;
  onChange: (next: CatalogFilterState) => void;
  onReset: () => void;
  facets: CatalogFacets;
};

export default function MobileFilterDrawer({
  open,
  onClose,
  filters,
  onChange,
  onReset,
  facets,
}: Props) {
  const i18n = useInterfaceTranslations("InterfaceProductsComponentsMobileFilterDrawer");
  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent
        side="left"
        className="w-[88%] max-w-sm bg-background p-0 lg:hidden"
      >
        <SheetHeader className="border-b border-border bg-secondary px-4 py-4 text-foreground">
          <SheetTitle className="text-base font-semibold text-foreground">
            {i18n("Product filters")}</SheetTitle>
        </SheetHeader>

        <div className="h-[calc(100%-3.25rem)] overflow-y-auto p-3">
          <FilterSidebar
            className="static max-h-none"
            filters={filters}
            onChange={onChange}
            onReset={onReset}
            facets={facets}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
