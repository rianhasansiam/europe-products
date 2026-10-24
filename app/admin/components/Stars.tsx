"use client";

import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

export default function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "h-3.5 w-3.5",
            star <= rating ? "fill-brand-gold text-brand-gold" : "text-gray-200",
          )}
        />
      ))}
    </span>
  );
}
