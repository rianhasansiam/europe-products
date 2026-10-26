
import { ShieldCheck } from "lucide-react";

type PolicyHeroProps = {
  /** Short eyebrow label shown above the title (e.g. "Legal"). */
  eyebrow?: string;
  /** Main page title, e.g. "Privacy Policy". */
  title: string;
  /** Short supporting description below the title. */
  description: string;
  /** ISO date string used for the "Last updated" stamp. */
  lastUpdated?: string;
};

/**
 * Shared hero header for policy pages.
 *
 * Renders a rounded card with a "Legal" eyebrow, rose-highlighted
 * last word in the title, the
 * description, and an optional last-updated timestamp. Used by the
 * `PrivacyHero`, `ReturnHero`, and `TermsHero` wrappers so all three
 * policy pages stay visually identical.
 */
export default function PolicyHero({
  eyebrow = "Legal",
  title,
  description,
  lastUpdated,
}: PolicyHeroProps) {
  const i18n = (source: string) => source;
  const words = title.split(" ");

  return (
    <header className="relative overflow-hidden rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border sm:p-10">
      <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-primary">
          {eyebrow}
        </span>
      </div>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
        {words.map((word, i) =>
          i === words.length - 1 ? (
            <span
              key={i}
              className="text-primary"
            >
              {word}
            </span>
          ) : (
            <span key={i}>{word} </span>
          )
        )}
      </h1>

      <p className="mt-3 max-w-2xl text-base leading-7 text-body">
        {description}
      </p>

      {lastUpdated && (
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {i18n("Last updated:")}{" "}
          <time dateTime={lastUpdated} className="text-body">
            {new Date(lastUpdated).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
        </p>
      )}
    </header>
  );
}
