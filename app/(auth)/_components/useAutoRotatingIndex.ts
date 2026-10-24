"use client";

import { useEffect, useState } from "react";

/**
 * Returns a `[index, setIndex]` pair that auto-advances every `intervalMs`
 * milliseconds. Used by both the login and register BrandPanels to rotate
 * through marketing perks without each page re-implementing the timer.
 */
export function useAutoRotatingIndex(total: number, intervalMs: number) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (total <= 1) return;

    const intervalId = window.setInterval(() => {
      setIndex((currentIndex) => (currentIndex + 1) % total);
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [total, intervalMs]);

  return [index, setIndex] as const;
}
