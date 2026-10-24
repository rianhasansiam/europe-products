"use client";


/**
 * Decorative background used by both the login and register pages.
 *
 * Pure presentation. Animations are driven by the keyframes injected by
 * `<AuthAnimations />` (kept in a sibling component so the SSR'd HTML
 * stays free of inline `<style>` blocks the user can flash on initial load).
 */
export default function AuthBackground() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: "var(--brand-light-bg)",
          backgroundSize: "200% 200%",
          animation: "meshShift 18s ease-in-out infinite",
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute start-[10%] top-[15%] z-0 h-72 w-72 rounded-full bg-brand-red/10 blur-3xl"
        style={{ animation: "drift 14s ease-in-out infinite" }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[12%] end-[8%] z-0 h-80 w-80 rounded-full bg-brand-white/50 blur-3xl"
        style={{ animation: "drift 18s ease-in-out infinite reverse" }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute end-[40%] top-[40%] z-0 h-56 w-56 rounded-full bg-brand-red/5 blur-3xl"
        style={{ animation: "drift 22s ease-in-out infinite" }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--brand-border) 1px, transparent 1px), linear-gradient(to bottom, var(--brand-border) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse at center, black 50%, transparent 80%)",
        }}
      />
    </>
  );
}
