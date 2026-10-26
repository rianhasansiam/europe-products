"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400";
const PRODUCT_VARIANT_IMAGE_EVENT = "SexToy:product-variant-image";

type VariantGalleryImage = {
  variantId: string;
  url: string;
  label?: string;
};

type GalleryItem = {
  url: string;
  variantIds: string[];
  alt?: string;
  label?: string;
};

type VariantImageChangeDetail = {
  productId: string;
  variantId: string | null;
  image: string | null;
};

function findVariantImageIndex(
  items: GalleryItem[],
  variantId: string | null | undefined,
  image: string | null | undefined,
) {
  if (!variantId && !image) return -1;
  return items.findIndex(
    (item) =>
      (variantId ? item.variantIds.includes(variantId) : false) ||
      (image ? item.url === image : false),
  );
}

const ProductGallery = ({
  productId,
  images,
  variantImages = [],
  initialVariantId = null,
  productName,
}: {
  productId: string;
  images: Array<{ url: string; alt?: string | null }>;
  variantImages?: VariantGalleryImage[];
  initialVariantId?: string | null;
  productName: string;
}) => {
  const i18n = useInterfaceTranslations("InterfaceProductsSlugComponentsProductGallery");
  const galleryItems = useMemo<GalleryItem[]>(() => {
    const items: GalleryItem[] = [];

    const addProductImage = (image: {
      url: string;
      alt?: string | null;
    }) => {
      const trimmed = image.url.trim();
      if (!trimmed || items.some((item) => item.url === trimmed)) return;
      items.push({
        url: trimmed,
        variantIds: [],
        alt: image.alt?.trim() || undefined,
      });
    };

    const addVariantImage = (variant: VariantGalleryImage) => {
      const trimmed = variant.url.trim();
      if (!trimmed) return;

      const existing = items.find((item) => item.url === trimmed);
      if (existing) {
        if (!existing.variantIds.includes(variant.variantId)) {
          existing.variantIds.push(variant.variantId);
        }
        if (!existing.label && variant.label) existing.label = variant.label;
        return;
      }

      items.push({
        url: trimmed,
        variantIds: [variant.variantId],
        label: variant.label,
      });
    };

    images.forEach(addProductImage);
    if (items.length === 0) {
      addProductImage({
        url: FALLBACK_PRODUCT_IMAGE,
        alt: `${productName} product image`,
      });
    }
    variantImages.forEach(addVariantImage);

    return items;
  }, [images, productName, variantImages]);

  const initialImageIndex = useMemo(
    () => findVariantImageIndex(galleryItems, initialVariantId, null),
    [galleryItems, initialVariantId],
  );

  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const selectedImage = useMemo(() => {
    if (selectedImageUrl) {
      const explicitIndex = galleryItems.findIndex(
        (item) => item.url === selectedImageUrl,
      );
      if (explicitIndex >= 0) return explicitIndex;
    }
    return initialImageIndex >= 0 ? initialImageIndex : 0;
  }, [galleryItems, initialImageIndex, selectedImageUrl]);

  const currentItem = galleryItems[selectedImage] ?? {
    url: FALLBACK_PRODUCT_IMAGE,
    variantIds: [],
  };
  const isVariantImage = currentItem.variantIds.length > 0;

  useEffect(() => {
    const handleVariantImageChange = (event: Event) => {
      const detail = (event as CustomEvent<VariantImageChangeDetail>).detail;
      if (!detail || detail.productId !== productId) return;

      const nextIndex = findVariantImageIndex(
        galleryItems,
        detail.variantId,
        detail.image,
      );
      const nextItem = galleryItems[nextIndex];
      if (nextItem) {
        setSelectedImageUrl(nextItem.url);
        return;
      }

      if (detail.variantId) {
        const productImage =
          galleryItems.find((item) => item.variantIds.length === 0) ??
          galleryItems[0];
        if (productImage) setSelectedImageUrl(productImage.url);
      }
    };

    window.addEventListener(
      PRODUCT_VARIANT_IMAGE_EVENT,
      handleVariantImageChange,
    );
    return () => {
      window.removeEventListener(
        PRODUCT_VARIANT_IMAGE_EVENT,
        handleVariantImageChange,
      );
    };
  }, [galleryItems, productId]);

  return (
    <div className="space-y-3">
      {/* Main Image */}
      <div
        className="relative aspect-4/5 overflow-hidden rounded-2xl border border-border bg-card"
        style={{ position: "relative" }}
      >
        <Image
          src={currentItem.url}
          alt={
            currentItem.alt ||
            (isVariantImage && currentItem.label
              ? `${productName} ${currentItem.label}`
              : i18n("{value0} - Image {value1}", { value0: productName, value1: selectedImage + 1 }))
          }
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
          preload
          className="object-contain p-4"
        />
        {isVariantImage && (
          <span className="absolute bottom-3 start-3 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
            {i18n("Selected variant")}</span>
        )}
      </div>

      {/* Thumbnails */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {galleryItems.map((item, index) => {
          const itemIsVariant = item.variantIds.length > 0;

          return (
            <button
              key={`${item.url}-${index}`}
              onClick={() => setSelectedImageUrl(item.url)}
              style={{ position: "relative" }}
              className={cn(
                "relative aspect-4/5 w-14 shrink-0 overflow-hidden rounded-xl border-2 bg-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selectedImage === index
                  ? "border-primary"
                  : "border-border hover:border-primary",
              )}
              aria-label={
                itemIsVariant && item.label
                  ? i18n("Show {value0} variant image", { value0: item.label })
                  : i18n("Show product image {value0}", { value0: index + 1 })
              }
            >
              <Image
                src={item.url}
                alt={
                  item.alt || (itemIsVariant && item.label
                    ? i18n("{value0} {value1} thumbnail", { value0: productName, value1: item.label })
                    : i18n("{value0} thumbnail {value1}", { value0: productName, value1: index + 1 }))
                }
                fill
                sizes="56px"
                className="object-cover"
              />
              {itemIsVariant && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute end-1 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white",
                    selectedImage === index ? "bg-primary" : "bg-background0",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ProductGallery;
