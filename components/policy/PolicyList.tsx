import React from "react";

type PolicyListProps = {
  items: React.ReactNode[];
};

/** Bulleted list using the shared storefront typography and rose markers. */
export default function PolicyList({ items }: PolicyListProps) {
  return (
    <ul className="space-y-2 ps-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            aria-hidden
            className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
          />
          <span className="text-base leading-7 text-body">{item}</span>
        </li>
      ))}
    </ul>
  );
}
