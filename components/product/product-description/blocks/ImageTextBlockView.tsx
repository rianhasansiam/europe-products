
import Image from "next/image";
import Link from "@/lib/i18n/navigation";

import type { ImageTextBlock } from "@/lib/types/product-description-blocks";
import { cn } from "@/lib/utils";

const EXTERNAL_URL = /^https?:\/\//i;

function isExternalUrl(url: string) {
  return EXTERNAL_URL.test(url);
}

export default function ImageTextBlockView({
  block,
}: {
  block: ImageTextBlock;
}) {
  if (!block.imageUrl?.trim()) return null;

  const imageOnRight = block.imagePosition === "right";

  return (
    <section
      aria-labelledby={
        block.heading?.trim() ? `it-${block.id}` : undefined
      }
      className={cn(
        "flex min-w-0 flex-col gap-6 md:flex-row md:items-center",
        imageOnRight && "md:flex-row-reverse",
      )}
    >
      {/* Image */}
      <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-2xl md:w-1/2">
        <Image
          src={block.imageUrl}
          alt={block.imageAlt}
          width={640}
          height={480}
          className="h-auto w-full rounded-2xl object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>

      {/* Text content */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {block.heading?.trim() && (
          <h2
            id={`it-${block.id}`}
            className="text-xl font-bold text-foreground [overflow-wrap:anywhere] sm:text-2xl"
          >
            {block.heading}
          </h2>
        )}
        {block.description?.trim() && (
          <p className="leading-relaxed text-body [overflow-wrap:anywhere]">
            {block.description}
          </p>
        )}
        {block.ctaLabel?.trim() && block.ctaUrl?.trim() && (
          <Link
            href={block.ctaUrl}
            {...(isExternalUrl(block.ctaUrl)
              ? {
                  target: "_blank",
                  rel: "noopener noreferrer",
                }
              : {})}
            className="inline-flex min-h-11 w-fit max-w-full items-center justify-center gap-2 whitespace-normal rounded-xl bg-primary px-5 py-2.5 text-center text-sm font-semibold text-primary-foreground transition [overflow-wrap:anywhere] hover:bg-primary-hover"
          >
            {block.ctaLabel}
          </Link>
        )}
      </div>
    </section>
  );
}
