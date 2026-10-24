"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { TableSkeleton } from "@/components/ui/loading";
import {
  removeCarouselBanner,
  removeCategoryBanner,
  removeDealBanner,
  removePromoBanner,
  removeTopBanner,
  setAdminBanners,
  setAdminBannersError,
  setAdminBannersLoading,
  upsertCarouselBanner,
  upsertCategoryBanner,
  upsertDealBanner,
  upsertPromoBanner,
  upsertTopBanner,
} from "@/store/slices/admin-banners.slice";
import type { AppDispatch, RootState } from "@/store";
import {
  buildCarouselForm,
  buildCategoryBannerForm,
  buildDealForm,
  buildPromoForm,
  buildTopForm,
  categoryBannerHref,
  createCarouselBanner,
  createCategoryBanner,
  createDealBanner,
  createPromoBanner,
  createTopBanner,
  deleteCarouselBanner,
  deleteCategoryBanner,
  deleteDealBanner,
  deletePromoBanner,
  deleteTopBanner,
  EMPTY_CAROUSEL_FORM,
  EMPTY_CATEGORY_BANNER_FORM,
  EMPTY_DEAL_FORM,
  EMPTY_PROMO_FORM,
  EMPTY_TOP_FORM,
  fetchActiveRootBannerCategories,
  fetchAllBanners,
  parseIntSafe,
  updateCarouselBanner,
  updateCategoryBanner,
  updateDealBanner,
  updatePromoBanner,
  updateTopBanner,
  type BannerKind,
  type CarouselBannerRow,
  type CarouselFormState,
  type CategoryBannerFormState,
  type CategoryBannerCategoryOption,
  type CategoryBannerRow,
  type DealBannerRow,
  type DealFormState,
  type PromoBannerRow,
  type PromoFormState,
  type TopBannerRow,
  type TopFormState,
} from "@/features/admin-banners/api";
import {
  confirmMajorAction,
  notifyActionError,
  notifyActionSuccess,
} from "@/lib/admin-feedback";
import { useAnimatedRemoval } from "@/hooks/useAnimatedRemoval";

import BannerSummaryCards from "./components/BannerSummaryCards";
import BannerTabsBar from "./components/BannerTabsBar";
import BannerFormDrawer from "./components/BannerFormDrawer";
import {
  CarouselList,
  CategoryList,
  DealList,
  PromoList,
  TopList,
} from "./components/BannerLists";
import type { EditingState } from "./components/constants";

export default function AdminBannersPage() {
  const i18n = useInterfaceTranslations("AdminAdminBannersPage");
  const dispatch = useDispatch<AppDispatch>();
  const carousel = useSelector((s: RootState) => s.adminBanners.carousel);
  const categoryBanners = useSelector(
    (s: RootState) => s.adminBanners.category,
  );
  const top = useSelector((s: RootState) => s.adminBanners.top);
  const deal = useSelector((s: RootState) => s.adminBanners.deal);
  const promo = useSelector((s: RootState) => s.adminBanners.promo);
  const isHydrated = useSelector((s: RootState) => s.adminBanners.isHydrated);
  const isLoading = useSelector((s: RootState) => s.adminBanners.isLoading);
  const error = useSelector((s: RootState) => s.adminBanners.error);

  const [activeTab, setActiveTab] = useState<BannerKind>("carousel");
  const [editing, setEditing] = useState<EditingState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  const [carouselForm, setCarouselForm] =
    useState<CarouselFormState>(EMPTY_CAROUSEL_FORM);
  const [categoryForm, setCategoryForm] = useState<CategoryBannerFormState>(
    EMPTY_CATEGORY_BANNER_FORM,
  );
  const [topForm, setTopForm] = useState<TopFormState>(EMPTY_TOP_FORM);
  const [dealForm, setDealForm] = useState<DealFormState>(EMPTY_DEAL_FORM);
  const [promoForm, setPromoForm] = useState<PromoFormState>(EMPTY_PROMO_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [categories, setCategories] = useState<
    CategoryBannerCategoryOption[]
  >([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const { visibleItems: visibleCarousel, queueRemoval: queueCarouselRemoval } =
    useAnimatedRemoval({
      items: carousel,
      getId: (banner) => banner.id,
    });
  const { visibleItems: visibleCategory, queueRemoval: queueCategoryRemoval } =
    useAnimatedRemoval({
      items: categoryBanners,
      getId: (banner) => banner.id,
    });
  const { visibleItems: visibleTop, queueRemoval: queueTopRemoval } =
    useAnimatedRemoval({
      items: top,
      getId: (banner) => banner.id,
    });
  const { visibleItems: visibleDeal, queueRemoval: queueDealRemoval } =
    useAnimatedRemoval({
      items: deal,
      getId: (banner) => banner.id,
    });
  const { visibleItems: visiblePromo, queueRemoval: queuePromoRemoval } =
    useAnimatedRemoval({
      items: promo,
      getId: (banner) => banner.id,
    });

  const refresh = useCallback(async () => {
    dispatch(setAdminBannersLoading(true));
    dispatch(setAdminBannersError(null));
    try {
      const bundle = await fetchAllBanners();
      dispatch(setAdminBanners(bundle));
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load banners.";
      dispatch(setAdminBannersError(message));
    } finally {
      dispatch(setAdminBannersLoading(false));
    }
  }, [dispatch]);

  useEffect(() => {
    if (isHydrated) return;
    void refresh();
  }, [isHydrated, refresh]);

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      try {
        const rows = await fetchActiveRootBannerCategories();
        if (!ignore) {
          setCategories(rows);
          setCategoriesError(null);
        }
      } catch (loadError) {
        if (!ignore) {
          const message =
            loadError instanceof Error
              ? loadError.message
              : "Failed to load categories.";
          setCategoriesError(message);
        }
      }
    };
    void run();
    return () => {
      ignore = true;
    };
  }, []);

  const totals = useMemo(() => {
    return {
      carousel: carousel.length,
      category: categoryBanners.length,
      top: top.length,
      deal: deal.length,
      promo: promo.length,
      activeCarousel: carousel.filter((b) => b.status === "ACTIVE").length,
      activeCategory: categoryBanners.filter((b) => b.status === "ACTIVE")
        .length,
      activeTop: top.filter((b) => b.status === "ACTIVE").length,
      activeDeal: deal.filter((b) => b.status === "ACTIVE").length,
      activePromo: promo.filter((b) => b.status === "ACTIVE").length,
    };
  }, [carousel, categoryBanners, deal, promo, top]);

  /* ---------------------------- Open / close panels ---------------------- */

  const openCreate = (kind: BannerKind) => {
    setEditing({ mode: "create", kind });
    setMutationError(null);
    if (kind === "carousel") setCarouselForm(EMPTY_CAROUSEL_FORM);
    if (kind === "category")
      setCategoryForm({
        ...EMPTY_CATEGORY_BANNER_FORM,
        categoryId: categories[0]?.id ?? "",
        link: categories[0] ? categoryBannerHref(categories[0].path) : "",
      });
    if (kind === "top") setTopForm(EMPTY_TOP_FORM);
    if (kind === "deal") setDealForm(EMPTY_DEAL_FORM);
    if (kind === "promo") setPromoForm(EMPTY_PROMO_FORM);
  };

  const openEditCarousel = (banner: CarouselBannerRow) => {
    setEditing({ mode: "edit", kind: "carousel", banner });
    setCarouselForm(buildCarouselForm(banner));
    setMutationError(null);
  };

  const openEditCategory = (banner: CategoryBannerRow) => {
    setEditing({ mode: "edit", kind: "category", banner });
    setCategoryForm(buildCategoryBannerForm(banner));
    setMutationError(null);
  };

  const openEditTop = (banner: TopBannerRow) => {
    setEditing({ mode: "edit", kind: "top", banner });
    setTopForm(buildTopForm(banner));
    setMutationError(null);
  };

  const openEditDeal = (banner: DealBannerRow) => {
    setEditing({ mode: "edit", kind: "deal", banner });
    setDealForm(buildDealForm(banner));
    setMutationError(null);
  };

  const openEditPromo = (banner: PromoBannerRow) => {
    setEditing({ mode: "edit", kind: "promo", banner });
    setPromoForm(buildPromoForm(banner));
    setMutationError(null);
  };

  const closePanel = () => {
    setEditing(null);
    setMutationError(null);
  };

  /* ---------------------------- Submit handlers -------------------------- */

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setMutationError(null);
    setSuccessNote(null);
    setIsSubmitting(true);

    try {
      if (editing.kind === "carousel") {
        const position = parseIntSafe(carouselForm.position, "Position");
        const isSolid = carouselForm.bgType === "solid";
        const body = {
          image: carouselForm.image.trim(),
          title: carouselForm.title.trim(),
          subtitle: carouselForm.subtitle.trim(),
          description: carouselForm.description.trim(),
          badge: carouselForm.badge.trim(),
          bgType: carouselForm.bgType,
          bgFrom: isSolid ? null : carouselForm.bgFrom.trim() || null,
          bgVia: isSolid ? null : carouselForm.bgVia.trim() || null,
          bgTo: isSolid ? null : carouselForm.bgTo.trim() || null,
          bgColor: isSolid ? carouselForm.bgColor.trim() || null : null,
          link: carouselForm.link.trim() || null,
          position,
          status: carouselForm.status,
        };
        if (editing.mode === "create") {
          const row = await createCarouselBanner(body);
          dispatch(upsertCarouselBanner(row));
          setSuccessNote("Carousel slide created.");
          notifyActionSuccess("Carousel slide created.");
        } else {
          const row = await updateCarouselBanner(editing.banner.id, body);
          dispatch(upsertCarouselBanner(row));
          setSuccessNote("Carousel slide updated.");
          notifyActionSuccess("Carousel slide updated.");
        }
      } else if (editing.kind === "category") {
        if (!categoryForm.categoryId) {
          throw new Error(i18n("Category is required."));
        }
        const body = {
          image: categoryForm.image.trim(),
          label: categoryForm.label.trim(),
          heading: categoryForm.heading.trim(),
          discount: categoryForm.discount.trim(),
          description: categoryForm.description.trim(),
          link: categoryForm.link.trim() || null,
          categoryId: categoryForm.categoryId,
          status: categoryForm.status,
        };
        if (editing.mode === "create") {
          const row = await createCategoryBanner(body);
          dispatch(upsertCategoryBanner(row));
          setSuccessNote("Category banner created.");
          notifyActionSuccess("Category banner created.");
        } else {
          const row = await updateCategoryBanner(editing.banner.id, body);
          dispatch(upsertCategoryBanner(row));
          setSuccessNote("Category banner updated.");
          notifyActionSuccess("Category banner updated.");
        }
      } else if (editing.kind === "top") {
        const position = parseIntSafe(topForm.position, "Position");
        const body = {
          icon: topForm.icon.trim(),
          badge: topForm.badge.trim(),
          discount: topForm.discount.trim(),
          description: topForm.description.trim(),
          tag: topForm.tag.trim(),
          tagIcon: topForm.tagIcon.trim(),
          link: topForm.link.trim() || null,
          position,
          status: topForm.status,
        };
        if (editing.mode === "create") {
          const row = await createTopBanner(body);
          dispatch(upsertTopBanner(row));
          setSuccessNote("Top banner created.");
          notifyActionSuccess("Top banner created.");
        } else {
          const row = await updateTopBanner(editing.banner.id, body);
          dispatch(upsertTopBanner(row));
          setSuccessNote("Top banner updated.");
          notifyActionSuccess("Top banner updated.");
        }
      } else if (editing.kind === "deal") {
        const position = parseIntSafe(dealForm.position, "Position");
        const body = {
          image: dealForm.image.trim(),
          title: dealForm.title.trim(),
          subtitle: dealForm.subtitle.trim(),
          bgClass: dealForm.bgClass.trim(),
          link: dealForm.link.trim() || null,
          position,
          status: dealForm.status,
        };
        if (editing.mode === "create") {
          const row = await createDealBanner(body);
          dispatch(upsertDealBanner(row));
          setSuccessNote("Deal banner created.");
          notifyActionSuccess("Deal banner created.");
        } else {
          const row = await updateDealBanner(editing.banner.id, body);
          dispatch(upsertDealBanner(row));
          setSuccessNote("Deal banner updated.");
          notifyActionSuccess("Deal banner updated.");
        }
      } else {
        const position = parseIntSafe(promoForm.position, "Position");
        const body = {
          image: promoForm.image.trim(),
          title: promoForm.title.trim(),
          subtitle: promoForm.subtitle.trim(),
          discount: promoForm.discount.trim(),
          bgClass: promoForm.bgClass.trim(),
          link: promoForm.link.trim() || null,
          position,
          status: promoForm.status,
        };
        if (editing.mode === "create") {
          const row = await createPromoBanner(body);
          dispatch(upsertPromoBanner(row));
          setSuccessNote("Promo banner created.");
          notifyActionSuccess("Promo banner created.");
        } else {
          const row = await updatePromoBanner(editing.banner.id, body);
          dispatch(upsertPromoBanner(row));
          setSuccessNote("Promo banner updated.");
          notifyActionSuccess("Promo banner updated.");
        }
      }
      closePanel();
    } catch (mutation) {
      const message =
        mutation instanceof Error ? mutation.message : "Banner mutation failed.";
      setMutationError(message);
      notifyActionError(mutation, "Banner mutation failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------------------------- Delete handlers -------------------------- */

  const handleDeleteCarousel = async (banner: CarouselBannerRow) => {
    const confirmed = await confirmMajorAction({
      title: i18n("Delete this carousel slide?"),
      description: i18n("This action cannot be undone."),
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    queueCarouselRemoval(
      banner.id,
      async () => {
        setMutationError(null);
        setSuccessNote(null);
        setBusyId(banner.id);
        try {
          await deleteCarouselBanner(banner.id);
          dispatch(removeCarouselBanner(banner.id));
          setSuccessNote("Carousel slide deleted.");
          notifyActionSuccess("Carousel slide deleted.");
        } catch (mutation) {
          const message =
            mutation instanceof Error ? mutation.message : "Delete failed.";
          setMutationError(message);
          throw new Error(message);
        } finally {
          setBusyId(null);
        }
      },
      (error) => {
        notifyActionError(error, "Delete failed.");
      },
    );
  };

  const handleDeleteCategory = async (banner: CategoryBannerRow) => {
    const confirmed = await confirmMajorAction({
      title: i18n("Delete this category banner?"),
      description: i18n("This action cannot be undone."),
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    queueCategoryRemoval(
      banner.id,
      async () => {
        setMutationError(null);
        setSuccessNote(null);
        setBusyId(banner.id);
        try {
          await deleteCategoryBanner(banner.id);
          dispatch(removeCategoryBanner(banner.id));
          setSuccessNote("Category banner deleted.");
          notifyActionSuccess("Category banner deleted.");
        } catch (mutation) {
          const message =
            mutation instanceof Error ? mutation.message : "Delete failed.";
          setMutationError(message);
          throw new Error(message);
        } finally {
          setBusyId(null);
        }
      },
      (error) => {
        notifyActionError(error, "Delete failed.");
      },
    );
  };

  const handleDeleteTop = async (banner: TopBannerRow) => {
    const confirmed = await confirmMajorAction({
      title: i18n("Delete this top strip?"),
      description: i18n("This action cannot be undone."),
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    queueTopRemoval(
      banner.id,
      async () => {
        setMutationError(null);
        setSuccessNote(null);
        setBusyId(banner.id);
        try {
          await deleteTopBanner(banner.id);
          dispatch(removeTopBanner(banner.id));
          setSuccessNote("Top banner deleted.");
          notifyActionSuccess("Top banner deleted.");
        } catch (mutation) {
          const message =
            mutation instanceof Error ? mutation.message : "Delete failed.";
          setMutationError(message);
          throw new Error(message);
        } finally {
          setBusyId(null);
        }
      },
      (error) => {
        notifyActionError(error, "Delete failed.");
      },
    );
  };

  const handleDeleteDeal = async (banner: DealBannerRow) => {
    const confirmed = await confirmMajorAction({
      title: i18n("Delete this deal banner?"),
      description: i18n("This action cannot be undone."),
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    queueDealRemoval(
      banner.id,
      async () => {
        setMutationError(null);
        setSuccessNote(null);
        setBusyId(banner.id);
        try {
          await deleteDealBanner(banner.id);
          dispatch(removeDealBanner(banner.id));
          setSuccessNote("Deal banner deleted.");
          notifyActionSuccess("Deal banner deleted.");
        } catch (mutation) {
          const message =
            mutation instanceof Error ? mutation.message : "Delete failed.";
          setMutationError(message);
          throw new Error(message);
        } finally {
          setBusyId(null);
        }
      },
      (error) => {
        notifyActionError(error, "Delete failed.");
      },
    );
  };

  const handleDeletePromo = async (banner: PromoBannerRow) => {
    const confirmed = await confirmMajorAction({
      title: i18n("Delete this promo banner?"),
      description: i18n("This action cannot be undone."),
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    queuePromoRemoval(
      banner.id,
      async () => {
        setMutationError(null);
        setSuccessNote(null);
        setBusyId(banner.id);
        try {
          await deletePromoBanner(banner.id);
          dispatch(removePromoBanner(banner.id));
          setSuccessNote("Promo banner deleted.");
          notifyActionSuccess("Promo banner deleted.");
        } catch (mutation) {
          const message =
            mutation instanceof Error ? mutation.message : "Delete failed.";
          setMutationError(message);
          throw new Error(message);
        } finally {
          setBusyId(null);
        }
      },
      (error) => {
        notifyActionError(error, "Delete failed.");
      },
    );
  };

  /* ---------------------------- Render ----------------------------------- */

  return (
    <section className="space-y-4">
      <BannerSummaryCards totals={totals} />

      <BannerTabsBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRefresh={() => {
          void refresh();
        }}
        onCreate={() => openCreate(activeTab)}
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {i18n(error)}
        </div>
      )}

      {categoriesError && activeTab === "category" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          {categoriesError}
        </div>
      )}

      {mutationError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {mutationError}
        </div>
      )}

      {successNote && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {successNote}
        </div>
      )}

      {isLoading && !isHydrated ? (
        <TableSkeleton rows={5} columns={6} ariaLabel="Loading banners" />
      ) : activeTab === "carousel" ? (
        <CarouselList
          rows={visibleCarousel}
          busyId={busyId}
          onEdit={openEditCarousel}
          onDelete={(banner) => {
            void handleDeleteCarousel(banner);
          }}
        />
      ) : activeTab === "category" ? (
        <CategoryList
          rows={visibleCategory}
          busyId={busyId}
          onEdit={openEditCategory}
          onDelete={(banner) => {
            void handleDeleteCategory(banner);
          }}
        />
      ) : activeTab === "top" ? (
        <TopList
          rows={visibleTop}
          busyId={busyId}
          onEdit={openEditTop}
          onDelete={(banner) => {
            void handleDeleteTop(banner);
          }}
        />
      ) : activeTab === "deal" ? (
        <DealList
          rows={visibleDeal}
          busyId={busyId}
          onEdit={openEditDeal}
          onDelete={(banner) => {
            void handleDeleteDeal(banner);
          }}
        />
      ) : (
        <PromoList
          rows={visiblePromo}
          busyId={busyId}
          onEdit={openEditPromo}
          onDelete={(banner) => {
            void handleDeletePromo(banner);
          }}
        />
      )}

      <BannerFormDrawer
        editing={editing}
        isSubmitting={isSubmitting}
        categories={categories}
        carouselForm={carouselForm}
        setCarouselForm={setCarouselForm}
        categoryForm={categoryForm}
        setCategoryForm={setCategoryForm}
        topForm={topForm}
        setTopForm={setTopForm}
        dealForm={dealForm}
        setDealForm={setDealForm}
        promoForm={promoForm}
        setPromoForm={setPromoForm}
        onClose={closePanel}
        onSubmit={handleSubmit}
      />
    </section>
  );
}
