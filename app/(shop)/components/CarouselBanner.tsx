"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";

import Image from "next/image";
import Link from "@/lib/i18n/navigation";
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { resolveBannerBackground } from "@/components/ui/tailwind-palette";
import styles from "./CarouselBanner.module.css";

const AUTO_ROTATE_INTERVAL_MS = 3_000;

export type CarouselSlide = {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  bgType: "gradient" | "solid";
  bgFrom: string | null;
  bgVia: string | null;
  bgTo: string | null;
  bgColor: string | null;
  link: string | null;
};

function subscribeToMotionPreference(onChange: () => void) {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  preference.addEventListener("change", onChange);
  return () => preference.removeEventListener("change", onChange);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function CaroselBanner({ slides }: { slides: CarouselSlide[] }) {
  const i18n = useInterfaceTranslations("InterfaceComponentsCarouselBanner");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const reduceMotion = useSyncExternalStore(
    subscribeToMotionPreference,
    prefersReducedMotion,
    () => true,
  );

  useEffect(() => {
    if (slides.length <= 1 || isPaused || isHovered || isFocused || reduceMotion) return;

    const intervalId = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % slides.length);
    }, AUTO_ROTATE_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [slides.length, isPaused, isHovered, isFocused, reduceMotion]);

  if (slides.length === 0) return null;

  // Slides can change between renders (admin edits + revalidation), so
  // clamp at render time to stay in range without an extra state sync.
  const safeIndex = Math.min(activeIndex, slides.length - 1);
  const activeDeal = slides[safeIndex];
  const hasImage = Boolean(activeDeal.image.trim()) && failedImage !== activeDeal.image;
  const hasHeading = Boolean(activeDeal.title || activeDeal.subtitle);
  // Null retains the existing default destination. An explicitly empty URL
  // does not produce an empty link or resurrect a deliberately omitted CTA.
  const primaryHref = activeDeal.link === null ? "/products" : activeDeal.link.trim();

  return (
    <section
      className={styles.hero}
      data-has-image={hasImage}
      aria-label={i18n("Featured banners")}
      aria-roledescription={slides.length > 1 ? "carousel" : undefined}
      style={{ "--hero-background": resolveBannerBackground(activeDeal) } as CSSProperties}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false);
      }}
    >
      {hasImage && (
        <div className={styles.media}>
          <Image
            src={activeDeal.image}
            alt={activeDeal.subtitle ? i18n(activeDeal.subtitle) : ""}
            fill
            className={styles.image}
            sizes="(min-width: 100rem) 100rem, 100vw"
            preload={safeIndex === 0}
            onError={() => setFailedImage(activeDeal.image)}
          />
        </div>
      )}
      <div className={styles.overlay} aria-hidden="true" />
      <div className={styles.content}>
        <div className={styles.copy}>
          {activeDeal.badge && (
            <span className={styles.badge}>{i18n(activeDeal.badge)}</span>
          )}
          {hasHeading && (
            <h1 className={styles.heading}>
              {activeDeal.title && i18n(activeDeal.title)}
              {activeDeal.title && activeDeal.subtitle ? " " : null}
              {activeDeal.subtitle && (
                <span className={styles.highlight}>{i18n(activeDeal.subtitle)}</span>
              )}
            </h1>
          )}
          {activeDeal.description && (
            <p className={styles.description}>{i18n(activeDeal.description)}</p>
          )}
          <div className={styles.actions}>
            {primaryHref && (
              <Link
                href={primaryHref}
                className={`${styles.button} ${styles.primary}`}
              >
                {i18n("Shop Now")}
              </Link>
            )}
            <Link href="/products" className={`${styles.button} ${styles.secondary}`}>
              {i18n("View Offers")}
            </Link>
          </div>
          {slides.length > 1 && (
            <div className={styles.controls}>
              <div className={styles.pagination}>
                {slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    className={styles.slideControl}
                    aria-label={`${i18n("Show banner")} ${index + 1}`}
                    aria-current={safeIndex === index ? "true" : undefined}
                    onClick={() => setActiveIndex(index)}
                  >
                    <span aria-hidden="true" />
                  </button>
                ))}
              </div>
              {!reduceMotion && (
                <button
                  type="button"
                  className={styles.pauseControl}
                  aria-pressed={isPaused}
                  onClick={() => setIsPaused((paused) => !paused)}
                >
                  {isPaused ? i18n("Play") : i18n("Pause")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
