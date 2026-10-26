"use client";

/** Shared, restrained surface behind the existing authentication layout. */
export default function AuthBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 bg-background"
    />
  );
}
