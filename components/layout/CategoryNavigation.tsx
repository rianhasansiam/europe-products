"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Grid3X3 } from "lucide-react";
import Link from "@/lib/i18n/navigation";

import {
  categoryHref,
  type PublicCategoryNode,
} from "@/features/categories/api";
import { cn } from "@/lib/utils";

export function DesktopCategoryMenu({
  categories,
  active,
}: {
  categories: PublicCategoryNode[];
  active: boolean;
}) {
  const i18n = useInterfaceTranslations("InterfaceLayoutCategoryNavigation");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="desktop-category-menu"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "relative flex items-center min-h-11 gap-1.5 rounded-xl px-2 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          active || open ? "bg-secondary text-primary" : "text-foreground hover:bg-secondary hover:text-primary",
        )}
      >
        <Grid3X3 className="h-4 w-4" />
        {i18n("Categories")}<ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        <span className={cn(
          "absolute bottom-0 left-1/2 h-0.5 w-[60%] -translate-x-1/2 rounded-full bg-primary transition",
          active || open ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0",
        )} />
      </button>

      {open && (
        <div
          id="desktop-category-menu"
          className="absolute left-1/2 top-full z-60 mt-3 w-[calc(100%-3rem)] max-w-6xl -translate-x-1/2 rounded-2xl border border-border bg-card p-5 shadow-lg"
        >
          <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
            <div>
              <p className="font-semibold text-foreground">{i18n("Shop by category")}</p>
              <p className="text-xs text-muted-foreground">{i18n("Browse departments and their most popular sections.")}</p>
            </div>
            <Link href="/categories" onClick={() => setOpen(false)} className="text-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              {i18n("View all categories")}</Link>
          </div>
          {categories.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{i18n("No categories available.")}</p>
          ) : (
            <div className="grid max-h-[65vh] grid-cols-2 gap-x-8 gap-y-6 overflow-y-auto lg:grid-cols-3 xl:grid-cols-4">
              {categories.map((root) => (
                <section key={root.id} className="min-w-0">
                  <Link
                    href={categoryHref(root)}
                    onClick={() => setOpen(false)}
                    className="group flex items-center justify-between gap-2 font-semibold text-foreground hover:bg-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="min-w-0 break-words">{root.name}</span>
                    <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground group-hover:text-primary">
                      {root.totalProductCount}
                    </span>
                  </Link>
                  {root.children.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {root.children.map((child) => (
                        <li key={child.id}>
                          <Link
                            href={categoryHref(child)}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-1.5 text-sm text-body hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            <ChevronRight className="h-3 w-3 shrink-0 rtl:rotate-180" />
                            <span className="truncate">{child.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MobileCategoryMenu({
  categories,
  onNavigate,
}: {
  categories: PublicCategoryNode[];
  onNavigate: () => void;
}) {
  const i18n = useInterfaceTranslations("InterfaceLayoutCategoryNavigation");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  return (
    <div className="mt-2 border-t border-border pt-2">
      <div className="mb-1 flex items-center justify-between px-4 py-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{i18n("Categories")}</p>
        <Link href="/categories" onClick={onNavigate} className="rounded-md py-2 text-xs font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{i18n("View all")}</Link>
      </div>
      {categories.map((root) => {
        const isExpanded = expanded.has(root.id);
        return (
          <div key={root.id} className="rounded-xl">
            <div className="flex items-center">
              <Link
                href={categoryHref(root)}
                onClick={onNavigate}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold text-foreground hover:bg-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Grid3X3 className="h-4 w-4 shrink-0" />
                <span className="truncate">{root.name}</span>
              </Link>
              {root.children.length > 0 && (
                <button
                  type="button"
                  aria-label={`${isExpanded ? i18n("Collapse") : i18n("Expand")} ${root.name}`}
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpanded((current) => {
                      const next = new Set(current);
                      if (next.has(root.id)) next.delete(root.id);
                      else next.add(root.id);
                      return next;
                    })
                  }
                  className="me-2 flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring hover:bg-secondary hover:text-primary"
                >
                  <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                </button>
              )}
            </div>
            {root.children.length > 0 && isExpanded && (
              <div className="ms-7 min-w-0 border-s border-border ps-3">
                {root.children.map((child) => (
                  <Link
                    key={child.id}
                    href={categoryHref(child)}
                    onClick={onNavigate}
                    className="flex min-w-0 items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-body hover:bg-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="min-w-0 break-words">{child.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{child.totalProductCount}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
