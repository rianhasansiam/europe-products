"use client";
import CurrencyAmount from "@/components/currency/CurrencyAmount";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, CircleDollarSign, PackageCheck, Warehouse } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";

import ProductFormDrawer from "@/app/admin/products/components/ProductFormDrawer";
import ProductsTable from "@/app/admin/products/components/ProductsTable";
import ProductsToolbar from "@/app/admin/products/components/ProductsToolbar";
import {
  fetchActiveBrandOptions,
  fetchActiveManufacturerOptions,
  type CatalogEntityOption,
} from "@/features/admin-catalog-entities/api";
import {
  buildFormFromProduct,
  categoryLabel,
  EMPTY_FORM,
  fetchActiveCategories,
  fetchAllProductsSnapshot,
  normalizeImagesInput,
  parseNumericField,
  rowsToStringMap,
  type AdminProduct,
  type CategoryOption,
  type ProductCondition,
  type ProductFormState,
  type ProductStatus,
} from "@/features/admin-products/api";
import { readApiError } from "@/features/http/api-envelope";
import {
  confirmMajorAction,
  notifyActionError,
  notifyActionSuccess,
} from "@/lib/admin-feedback";
import {
  isValidProductColor,
  normalizeProductColor,
  PRODUCT_COLOR_VALIDATION_MESSAGE,
} from "@/lib/catalog/product-color";
import { deriveVariantKey } from "@/lib/catalog/variant-options";
import {
  setAdminProducts,
  setAdminProductsError,
  setAdminProductsLoading,
} from "@/store/slices/admin-products.slice";
import type { AppDispatch, RootState } from "@/store";

type ProductWriteBody = {
  name: string;
  description: string | null;
  descriptionBlocks: unknown[] | null;
  seoTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  gtin: string | null;
  itemCondition: ProductCondition;
  primaryImageAlt: string | null;
  modelNumber: string | null;
  series: string | null;
  specifications: Record<string, string> | null;
  buyingPrice: number;
  salePrice: number;
  discountPrice: number | null;
  image: string | null;
  images: string[];
  status: ProductStatus;
  categoryId: string;
  brandId: string | null;
  manufacturerId: string | null;
  variants: Array<{
    id?: string;
    name: string | null;
    size: string | null;
    color: string | null;
    modelNumber: string | null;
    sku: string | null;
    stock: number;
    image: string | null;
    attributes: Record<string, string> | null;
    isActive: boolean;
  }>;
};

function optional(value: string): string | null {
  return value.trim() || null;
}

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: import("react").ReactNode;
  detail: string;
  icon: typeof Boxes;
}) {
  return (
    <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-gray-950">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{detail}</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-red/10 text-brand-red">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

export default function AdminProductsPage() {
  const i18n = useInterfaceTranslations("AdminAdminProductsPage");
  const dispatch = useDispatch<AppDispatch>();
  const products = useSelector((state: RootState) => state.adminProducts.items);
  const isLoading = useSelector((state: RootState) => state.adminProducts.isLoading);
  const loadError = useSelector((state: RootState) => state.adminProducts.error);

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [brands, setBrands] = useState<CatalogEntityOption[]>([]);
  const [manufacturers, setManufacturers] = useState<CatalogEntityOption[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ProductStatus>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | string>("ALL");
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<"create" | "edit">("create");
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  const originalVariantColors = useMemo<ReadonlyMap<string, string | null>>(
    () =>
      new Map(
        (editingProduct?.variants ?? []).flatMap((variant) =>
          variant.id ? [[variant.id, variant.color] as const] : [],
        ),
      ),
    [editingProduct],
  );

  const refreshProducts = useCallback(async () => {
    dispatch(setAdminProductsLoading(true));
    dispatch(setAdminProductsError(null));
    try {
      dispatch(setAdminProducts(await fetchAllProductsSnapshot()));
    } catch (error) {
      dispatch(setAdminProductsError(error instanceof Error ? error.message : "Failed to load products."));
    } finally {
      dispatch(setAdminProductsLoading(false));
    }
  }, [dispatch]);

  const refreshOptions = useCallback(async () => {
    try {
      const [categoryRows, brandRows, manufacturerRows] = await Promise.all([
        fetchActiveCategories(),
        fetchActiveBrandOptions(),
        fetchActiveManufacturerOptions(),
      ]);
      setCategories(categoryRows);
      setBrands(brandRows);
      setManufacturers(manufacturerRows);
      setOptionsError(null);
    } catch (error) {
      setOptionsError(error instanceof Error ? error.message : "Failed to load catalog options.");
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void refreshProducts();
      void refreshOptions();
    });
    return () => cancelAnimationFrame(frame);
  }, [refreshOptions, refreshProducts]);

  const categoryOptions = useMemo(() => {
    const options = new Map(categories.map((category) => [category.id, category.label]));
    for (const product of products) {
      if (!options.has(product.categoryId)) options.set(product.categoryId, categoryLabel(product));
    }
    return [...options].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, products]);

  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      const searchable = [
        product.name,
        product.slug,
        product.productCode,
        product.seoTitle,
        product.metaDescription,
        product.gtin,
        product.modelNumber,
        product.series,
        categoryLabel(product),
        product.brand?.name,
        product.manufacturer?.name,
        ...product.variants.flatMap((variant) => [
          variant.sku,
          variant.name,
          variant.modelNumber,
          variant.attributeSummary,
        ]),
      ].filter(Boolean).join(" ").toLowerCase();
      return (
        (!needle || searchable.includes(needle)) &&
        (statusFilter === "ALL" || product.status === statusFilter) &&
        (categoryFilter === "ALL" || product.categoryId === categoryFilter)
      );
    });
  }, [categoryFilter, products, query, statusFilter]);

  const summary = useMemo(() => ({
    active: products.filter((product) => product.status === "ACTIVE").length,
    stock: products.reduce((sum, product) => sum + product.stock, 0),
    value: products.reduce((sum, product) => sum + product.buyingPrice * product.stock, 0),
  }), [products]);

  const openCreate = () => {
    setPanelMode("create");
    setEditingProduct(null);
    setForm({
      ...EMPTY_FORM,
      categoryId: categories[0]?.id ?? "",
      variants: EMPTY_FORM.variants.map((variant) => ({ ...variant, attributes: [] })),
      specifications: [],
    });
    setMutationError(null);
    setPanelOpen(true);
  };

  const openEdit = (product: AdminProduct) => {
    setPanelMode("edit");
    setEditingProduct(product);
    setForm(buildFormFromProduct(product));
    setMutationError(null);
    setPanelOpen(true);
  };

  const closePanel = useCallback(() => {
    if (!isSubmitting) setPanelOpen(false);
  }, [isSubmitting]);

  const buildBody = (): ProductWriteBody => {
    const missingFields: string[] = [];
    const name = form.name.trim();
    if (!name) missingFields.push("Product name");

    if (!form.categoryId) missingFields.push("Category");

    if (!form.buyingPrice.trim()) missingFields.push("Buying price");
    if (!form.salePrice.trim()) missingFields.push("Sale price");

    if (form.variants.length === 0) {
      missingFields.push("At least one variant");
    }

    form.variants.forEach((variant, index) => {
      if (!variant.stock.trim()) {
        missingFields.push(`Variant ${index + 1} stock`);
      }
    });

    if (missingFields.length > 0) {
      throw new Error(`Missing mandatory field(s): ${missingFields.join(", ")}.`);
    }

    if (
      panelMode === "edit" &&
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())
    ) {
      throw new Error(
        i18n("Canonical slug must use lowercase letters, numbers, and single hyphens."),
      );
    }

    const buyingPrice = parseNumericField(form.buyingPrice, "Buying price");
    const salePrice = parseNumericField(form.salePrice, "Sale price");
    if (buyingPrice < 0 || salePrice < 0) throw new Error(i18n("Prices cannot be negative."));
    const discountPrice = form.discountPrice.trim()
      ? parseNumericField(form.discountPrice, "Discount price")
      : null;
    if (discountPrice !== null && (discountPrice < 0 || discountPrice > salePrice)) {
      throw new Error(i18n("Discount price must be between zero and the sale price."));
    }

    const seenCombinations = new Set<string>();
    const seenSkus = new Set<string>();
    const variants = form.variants.map((variant, index) => {
      const stock = parseNumericField(variant.stock, `Variant ${index + 1} stock`);
      if (!Number.isInteger(stock) || stock < 0) {
        throw new Error(`Variant ${index + 1} stock must be a non-negative whole number.`);
      }
      const variantId = variant.id;
      const hasOriginalColor =
        panelMode === "edit" &&
        variantId !== undefined &&
        originalVariantColors.has(variantId);
      const originalColor =
        hasOriginalColor && variantId !== undefined
          ? originalVariantColors.get(variantId) ?? null
          : null;
      const colorWasUnchanged =
        hasOriginalColor && variant.color === (originalColor ?? "");
      const enteredColor = optional(variant.color);
      let color = enteredColor;
      if (colorWasUnchanged) {
        color = originalColor;
      } else if (enteredColor !== null) {
        if (!isValidProductColor(enteredColor)) {
          throw new Error(
            `Variant ${index + 1} color: ${PRODUCT_COLOR_VALIDATION_MESSAGE}`,
          );
        }
        color = normalizeProductColor(enteredColor);
      }
      const attributes = rowsToStringMap(variant.attributes);
      const variantKey = deriveVariantKey({
        size: optional(variant.size),
        color,
        attributes,
      });
      if (seenCombinations.has(variantKey)) throw new Error(`Variant ${index + 1} duplicates another option combination.`);
      seenCombinations.add(variantKey);
      const sku = optional(variant.sku);
      if (sku) {
        const skuKey = sku.toLowerCase();
        if (seenSkus.has(skuKey)) throw new Error(`Duplicate SKU: ${sku}.`);
        seenSkus.add(skuKey);
      }
      return {
        ...(variant.id ? { id: variant.id } : {}),
        name: optional(variant.name),
        size: optional(variant.size),
        color,
        modelNumber: optional(variant.modelNumber),
        sku,
        stock,
        image: optional(variant.image),
        attributes,
        isActive: variant.isActive,
      };
    });
    if (variants.length > 1 && seenCombinations.has("default")) {
      throw new Error(i18n("Only a single optionless variant may use the default combination."));
    }

    return {
      name,
      description: optional(form.description),
      descriptionBlocks:
        Array.isArray(form.descriptionBlocks) && form.descriptionBlocks.length > 0
          ? form.descriptionBlocks
          : null,
      seoTitle: optional(form.seoTitle),
      metaDescription: optional(form.metaDescription),
      ogImage: optional(form.ogImage),
      gtin: optional(form.gtin),
      itemCondition: form.itemCondition,
      primaryImageAlt: optional(form.primaryImageAlt),
      modelNumber: optional(form.modelNumber),
      series: optional(form.series),
      specifications: rowsToStringMap(form.specifications),
      buyingPrice,
      salePrice,
      discountPrice,
      image: optional(form.image),
      images: normalizeImagesInput(form.images),
      status: form.status,
      categoryId: form.categoryId,
      brandId: form.brandId || null,
      manufacturerId: form.manufacturerId || null,
      variants,
    };
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMutationError(null);
    setSuccessNote(null);
    let body: ProductWriteBody;
    try {
      body = buildBody();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Invalid product data.");
      return;
    }

    setIsSubmitting(true);
    try {
      const requestBody: Partial<ProductWriteBody> & { slug?: string } = {
        ...body,
      };
      if (panelMode === "edit" && editingProduct) {
        const slug = form.slug.trim();
        if (slug !== editingProduct.slug) requestBody.slug = slug;
        if (body.brandId === editingProduct.brandId) delete requestBody.brandId;
        if (body.manufacturerId === editingProduct.manufacturerId) {
          delete requestBody.manufacturerId;
        }
      }
      const response = await fetch(
        panelMode === "create" ? "/api/products" : `/api/products/${editingProduct?.id}`,
        {
          method: panelMode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          cache: "no-store",
        },
      );
      const payload = await response.json().catch(() => null) as unknown;
      if (!response.ok) throw new Error(readApiError(payload, "Failed to save product."));
      const note = panelMode === "create" ? "Product created." : "Product updated.";
      setPanelOpen(false);
      setSuccessNote(note);
      notifyActionSuccess(note);
      await refreshProducts();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save product.";
      setMutationError(message);
      notifyActionError(message, "Failed to save product.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (product: AdminProduct) => {
    const status: ProductStatus = product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setBusyId(product.id);
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null) as unknown;
      if (!response.ok) throw new Error(readApiError(payload, "Failed to update product status."));
      notifyActionSuccess(status === "ACTIVE" ? "Product published." : "Product hidden.");
      await refreshProducts();
    } catch (error) {
      notifyActionError(error, "Failed to update product status.");
    } finally {
      setBusyId(null);
    }
  };

  const deleteProduct = async (product: AdminProduct) => {
    const confirmed = await confirmMajorAction({
      title: `Delete ${product.name}?`,
      description: i18n("This permanently removes the product and its variants. Historical order snapshots remain."),
      confirmLabel: "Delete product",
    });
    if (!confirmed) return;
    setBusyId(product.id);
    try {
      const response = await fetch(`/api/products/${product.id}`, { method: "DELETE", cache: "no-store" });
      const payload = await response.json().catch(() => null) as unknown;
      if (!response.ok) throw new Error(readApiError(payload, "Failed to delete product."));
      notifyActionSuccess("Product deleted.");
      await refreshProducts();
    } catch (error) {
      notifyActionError(error, "Failed to delete product.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-red">{i18n("Catalog")}</p>
        <h1 className="mt-1 text-2xl font-black text-gray-950 sm:text-3xl">{i18n("Products")}</h1>
        <p className="mt-1 text-sm text-gray-600">{i18n("Manage classification, technical data, pricing, media and purchasable option combinations.")}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label={i18n("Products")} value={products.length} detail="All catalog records" icon={Boxes} />
        <SummaryCard label={i18n("Published")} value={summary.active} detail="Visible when category ancestry is active" icon={PackageCheck} />
        <SummaryCard label={i18n("Units in stock")} value={summary.stock} detail="Across active variants" icon={Warehouse} />
        <SummaryCard label={i18n("Stock cost")} value={<CurrencyAmount amountUSD={summary.value} />} detail="Buying price × current stock" icon={CircleDollarSign} />
      </div>

      {(loadError || optionsError) && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError ?? optionsError}</div>
      )}
      {successNote && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{successNote}</div>}

      <ProductsToolbar
        query={query}
        statusFilter={statusFilter}
        categoryFilter={categoryFilter}
        categoryOptions={categoryOptions}
        visibleCount={visibleProducts.length}
        totalCount={products.length}
        isLoading={isLoading}
        onQueryChange={setQuery}
        onStatusChange={setStatusFilter}
        onCategoryChange={setCategoryFilter}
        onRefresh={() => { void refreshProducts(); void refreshOptions(); }}
        onCreate={openCreate}
      />

      <ProductsTable
        products={visibleProducts}
        isLoading={isLoading}
        totalCount={products.length}
        busyActionProductId={busyId}
        onEdit={openEdit}
        onToggleHide={(product) => { void toggleStatus(product); }}
        onDelete={(product) => { void deleteProduct(product); }}
      />

      <ProductFormDrawer
        open={panelOpen}
        mode={panelMode}
        form={form}
        originalVariantColors={originalVariantColors}
        categories={categories}
        currentCategory={
          editingProduct
            ? {
                id: editingProduct.categoryId,
                label: categoryLabel(editingProduct),
              }
            : null
        }
        brands={brands}
        manufacturers={manufacturers}
        error={mutationError}
        isSubmitting={isSubmitting}
        onChange={setForm}
        onClose={closePanel}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
