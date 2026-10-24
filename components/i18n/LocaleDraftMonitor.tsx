"use client";

import { useEffect } from "react";
import { markLanguageFormDirty, resetLanguageFormDirty } from "@/lib/i18n/drafts";

/** Real edits remain detectable when React updates a controlled input's defaults. */
export default function LocaleDraftMonitor() {
  useEffect(() => {
    const edited = (event: Event) => {
      const form = event.target instanceof Element ? event.target.closest("form") : null;
      if (form instanceof HTMLFormElement) markLanguageFormDirty(form);
    };
    const reset = (event: Event) => {
      if (event.target instanceof HTMLFormElement) resetLanguageFormDirty(event.target);
    };
    document.addEventListener("input", edited, true);
    document.addEventListener("change", edited, true);
    document.addEventListener("reset", reset, true);
    return () => {
      document.removeEventListener("input", edited, true);
      document.removeEventListener("change", edited, true);
      document.removeEventListener("reset", reset, true);
    };
  }, []);
  return null;
}
