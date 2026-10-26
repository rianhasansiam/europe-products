"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useEffect, useState } from "react";
import { Menu, ShieldCheck } from "lucide-react";
import { usePathname } from "@/lib/i18n/navigation";

import AdminSidebar from "@/app/admin/components/AdminSidebar";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const i18n = useInterfaceTranslations("AdminAdminComponentsAdminShell");
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setSidebarOpen(false));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-brand-light-bg">
      <div className="flex w-full">
        <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="min-w-0 flex-1 px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <div className="sticky top-0 z-40 mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-brand-border bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur-md lg:hidden">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label={i18n("Open admin menu")}
                aria-expanded={sidebarOpen}
                aria-controls="admin-sidebar"
                className="rounded-lg p-2 text-gray-700 transition-colors duration-200 hover:bg-brand-light-bg hover:text-brand-red"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-red">
                  <ShieldCheck className="h-4 w-4 text-white" />
                </div>
                <span className="text-base font-extrabold text-brand-black">
                  {i18n("Admin Panel")}</span>
              </div>
            </div>

            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
