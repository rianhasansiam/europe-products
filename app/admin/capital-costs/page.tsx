"use client";
import { BASE_CURRENCY } from "@/lib/currency/config";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useCallback, useEffect, useState } from "react";
import { Plus, Receipt, RotateCcw } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";

import {
  removeOtherCost,
  setActivity,
  setCapital,
  setCapitalCostSummary,
  setProductCost,
  setCapitalCostOverview,
  setCapitalCostsError,
  setCapitalCostsLoading,
  setOtherCosts,
  upsertOtherCost,
} from "@/store/slices/admin-capital-costs.slice";
import { LoadingSpinner } from "@/components/ui/loading";
import type { AppDispatch, RootState } from "@/store";
import {
  buildOtherCostForm,
  createOtherCost,
  deleteOtherCost,
  EMPTY_CAPITAL_FORM,
  EMPTY_OTHER_COST_FILTERS,
  emptyOtherCostForm,
  fetchCapitalCostOverview,
  fetchOtherCosts,
  formatCurrency,
  fromDateTimeLocal,
  parsePositiveAmount,
  addCapital,
  addProductCosts,
  fetchProductCostOptions,
  removeProductCost,
  updateOtherCost,
  type CapitalFormState,
  type OtherCostFilters as Filters,
  type OtherCostFormState,
  type OtherCostRow,
  type ProductCostItem,
  type ProductCostOption,
} from "@/features/admin-capital-costs/api";
import {
  confirmMajorAction,
  notifyActionError,
  notifyActionSuccess,
} from "@/lib/admin-feedback";
import { useAnimatedRemoval } from "@/hooks/useAnimatedRemoval";

import CapitalCostSummaryCards from "./components/CapitalCostSummaryCards";
import CapitalForm from "./components/CapitalForm";
import ProductCostCard from "./components/ProductCostCard";
import ProductCostPickerDrawer from "./components/ProductCostPickerDrawer";
import OtherCostFilters from "./components/OtherCostFilters";
import OtherCostFormDrawer from "./components/OtherCostFormDrawer";
import OtherCostsTable from "./components/OtherCostsTable";
import CapitalCostActivity from "./components/CapitalCostActivity";

const CURRENCY = BASE_CURRENCY;

export default function AdminCapitalCostsPage() {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminCapitalCostsPage");
  const dispatch = useDispatch<AppDispatch>();
  const capital = useSelector((s: RootState) => s.adminCapitalCosts.capital);
  const productCost = useSelector(
    (s: RootState) => s.adminCapitalCosts.productCost,
  );
  const summary = useSelector((s: RootState) => s.adminCapitalCosts.summary);
  const otherCosts = useSelector(
    (s: RootState) => s.adminCapitalCosts.otherCosts,
  );
  const activity = useSelector(
    (s: RootState) => s.adminCapitalCosts.activity,
  );
  const isHydrated = useSelector(
    (s: RootState) => s.adminCapitalCosts.isHydrated,
  );
  const isLoading = useSelector((s: RootState) => s.adminCapitalCosts.isLoading);
  const error = useSelector((s: RootState) => s.adminCapitalCosts.error);

  // Capital form
  const [capitalForm, setCapitalForm] =
    useState<CapitalFormState>(EMPTY_CAPITAL_FORM);
  const [isSavingCapital, setIsSavingCapital] = useState(false);
  const [capitalError, setCapitalError] = useState<string | null>(null);
  const [capitalNote, setCapitalNote] = useState<string | null>(null);

  // Product-cost picker
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productOptions, setProductOptions] = useState<ProductCostOption[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isLoadingProductOptions, setIsLoadingProductOptions] = useState(false);
  const [isSavingProductCosts, setIsSavingProductCosts] = useState(false);
  const [productPickerError, setProductPickerError] = useState<string | null>(null);
  const [busyProductCostId, setBusyProductCostId] = useState<string | null>(null);

  // Other-cost filters
  const [filters, setFilters] = useState<Filters>(EMPTY_OTHER_COST_FILTERS);
  const [filterActive, setFilterActive] = useState(false);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);

  // Other-cost drawer
  const [editing, setEditing] = useState<
    { mode: "create" } | { mode: "edit"; cost: OtherCostRow } | null
  >(null);
  const [costForm, setCostForm] = useState<OtherCostFormState>(
    emptyOtherCostForm(),
  );
  const [isSubmittingCost, setIsSubmittingCost] = useState(false);
  const [costDrawerError, setCostDrawerError] = useState<string | null>(null);

  // Table delete state
  const [busyId, setBusyId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [listNote, setListNote] = useState<string | null>(null);
  const { visibleItems: visibleCosts, queueRemoval } = useAnimatedRemoval({
    items: otherCosts,
    getId: (cost) => cost.id,
  });

  /* ---------------------------- Hydration ---------------------------- */

  const refresh = useCallback(async () => {
    await Promise.resolve();

    dispatch(setCapitalCostsLoading(true));
    dispatch(setCapitalCostsError(null));
    try {
      const overview = await fetchCapitalCostOverview();
      dispatch(
        setCapitalCostOverview({
          capital: overview.capital,
          productCost: overview.productCost,
          summary: overview.summary,
          otherCosts: overview.otherCosts.items,
          activity: overview.activity,
        }),
      );
      setCapitalForm(EMPTY_CAPITAL_FORM);
      setFilteredTotal(overview.otherCosts.total);
      setFilterActive(false);
      setFilters(EMPTY_OTHER_COST_FILTERS);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load capital & cost data.";
      dispatch(setCapitalCostsError(message));
    } finally {
      dispatch(setCapitalCostsLoading(false));
    }
  }, [dispatch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  /**
   * Pull fresh summary/cards + capital without clobbering a filtered
   * list. Used after a mutation so the headline numbers stay accurate.
   */
  const syncSummary = useCallback(async () => {
    try {
      const overview = await fetchCapitalCostOverview();
      dispatch(setCapitalCostSummary(overview.summary));
      dispatch(setCapital(overview.capital));
      dispatch(setProductCost(overview.productCost));
      dispatch(setActivity(overview.activity));
      if (!filterActive) {
        setFilteredTotal(overview.otherCosts.total);
        dispatch(setOtherCosts(overview.otherCosts.items));
      }
    } catch {
      // Non-fatal: the row-level change already succeeded.
    }
  }, [dispatch, filterActive]);

  /* ---------------------------- Capital form ------------------------- */

  const handleCapitalSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setCapitalError(null);
    setCapitalNote(null);

    try {
      const amount = parsePositiveAmount(
        capitalForm.amount || "0",
        "Capital amount",
      );

      setIsSavingCapital(true);
      const added = await addCapital({
        amount,
        note: capitalForm.note.trim() || null,
      });
      dispatch(setCapital(added));
      setCapitalForm(EMPTY_CAPITAL_FORM);
      await syncSummary();
      const message = i18n("Capital added.");
      setCapitalNote(message);
      notifyActionSuccess(message);
    } catch (mutation) {
      const message =
        mutation instanceof Error ? mutation.message : "Failed to add capital.";
      setCapitalError(message);
      notifyActionError(mutation, "Failed to add capital.");
    } finally {
      setIsSavingCapital(false);
    }
  };

  /* ----------------------- Product-cost selections ------------------- */

  const openProductPicker = () => {
    setProductPickerOpen(true);
    setSelectedProductIds([]);
    setProductPickerError(null);
    setIsLoadingProductOptions(true);

    void fetchProductCostOptions()
      .then((options) => setProductOptions(options))
      .catch((loadError) => {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load products.";
        setProductPickerError(message);
      })
      .finally(() => setIsLoadingProductOptions(false));
  };

  const closeProductPicker = (force = false) => {
    if (isSavingProductCosts && !force) return;
    setProductPickerOpen(false);
    setSelectedProductIds([]);
    setProductPickerError(null);
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  };

  const handleProductCostSubmit = async () => {
    setProductPickerError(null);
    try {
      if (selectedProductIds.length === 0) {
        throw new Error(i18n("Select at least one product."));
      }

      setIsSavingProductCosts(true);
      const updated = await addProductCosts(selectedProductIds);
      dispatch(setProductCost(updated));
      await syncSummary();
      closeProductPicker(true);
      notifyActionSuccess(
        `${selectedProductIds.length} product cost${selectedProductIds.length === 1 ? "" : "s"} added.`,
      );
    } catch (mutation) {
      const message =
        mutation instanceof Error
          ? mutation.message
          : "Failed to add selected product costs.";
      setProductPickerError(message);
      notifyActionError(mutation, "Failed to add selected product costs.");
    } finally {
      setIsSavingProductCosts(false);
    }
  };

  const handleRemoveProductCost = async (item: ProductCostItem) => {
    const confirmed = await confirmMajorAction({
      title: `Remove "${item.productName}"?`,
      description:
        i18n("This product will no longer be included in the product-cost total."),
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!confirmed) return;

    setBusyProductCostId(item.id);
    try {
      await removeProductCost(item.id);
      await syncSummary();
      notifyActionSuccess("Product cost removed.");
    } catch (mutation) {
      notifyActionError(mutation, "Failed to remove product cost.");
    } finally {
      setBusyProductCostId(null);
    }
  };

  /* ---------------------------- Filters ------------------------------ */

  const applyFilters = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const result = await fetchOtherCosts({
        page: 1,
        pageSize: 100,
        search: filters.search,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        minAmount: filters.minAmount,
        maxAmount: filters.maxAmount,
      });
      dispatch(setOtherCosts(result.items));
      setFilteredTotal(result.filteredTotalAmount);
      const active =
        Boolean(filters.search) ||
        Boolean(filters.dateFrom) ||
        Boolean(filters.dateTo) ||
        Boolean(filters.minAmount) ||
        Boolean(filters.maxAmount);
      setFilterActive(active);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to filter cost records.";
      setListError(message);
      notifyActionError(loadError, "Failed to filter cost records.");
    } finally {
      setListLoading(false);
    }
  }, [dispatch, filters]);

  const resetFilters = () => {
    setFilters(EMPTY_OTHER_COST_FILTERS);
    void refresh();
  };

  /* ---------------------------- Other-cost CRUD ---------------------- */

  const openCreateCost = () => {
    setEditing({ mode: "create" });
    setCostForm(emptyOtherCostForm());
    setCostDrawerError(null);
  };

  const openEditCost = (cost: OtherCostRow) => {
    setEditing({ mode: "edit", cost });
    setCostForm(buildOtherCostForm(cost));
    setCostDrawerError(null);
  };

  const closeCostDrawer = () => {
    setEditing(null);
    setCostDrawerError(null);
  };

  const handleCostSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!editing) return;
    setCostDrawerError(null);
    setListNote(null);

    try {
      const reason = costForm.reason.trim();
      if (!reason) throw new Error(i18n("Reason is required."));

      const amount = parsePositiveAmount(costForm.amount || "0", "Amount");

      const costDate = fromDateTimeLocal(costForm.costDate);
      if (!costDate) throw new Error(i18n("Cost date is required."));

      const body = {
        amount,
        reason,
        description: costForm.description.trim() || null,
        costDate,
      };

      setIsSubmittingCost(true);
      const cost =
        editing.mode === "create"
          ? await createOtherCost(body)
          : await updateOtherCost(editing.cost.id, body);
      dispatch(upsertOtherCost(cost));
      await syncSummary();
      const message =
        editing.mode === "create"
          ? "Cost record added."
          : "Cost record updated.";
      setListNote(message);
      notifyActionSuccess(message);
      closeCostDrawer();
    } catch (mutation) {
      const message =
        mutation instanceof Error
          ? mutation.message
          : "Failed to save cost record.";
      setCostDrawerError(message);
      notifyActionError(mutation, "Failed to save cost record.");
    } finally {
      setIsSubmittingCost(false);
    }
  };

  const handleDeleteCost = async (cost: OtherCostRow) => {
    const confirmed = await confirmMajorAction({
      title: `Delete "${cost.reason}"?`,
      description: i18n("This cost record will be permanently removed."),
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;

    queueRemoval(
      cost.id,
      async () => {
        setListError(null);
        setListNote(null);
        setBusyId(cost.id);
        try {
          await deleteOtherCost(cost.id);
          dispatch(removeOtherCost(cost.id));
          await syncSummary();
          setListNote("Cost record deleted.");
          notifyActionSuccess("Cost record deleted.");
        } catch (mutation) {
          const message =
            mutation instanceof Error
              ? mutation.message
              : "Failed to delete cost record.";
          setListError(message);
          throw new Error(message);
        } finally {
          setBusyId(null);
        }
      },
      (deleteError) => {
        notifyActionError(deleteError, "Failed to delete cost record.");
      },
    );
  };

  const loadingCards = isLoading && !summary;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-gray-900 sm:text-xl">
            {i18n("Capital & Cost Tracker")}</h1>
          <p className="text-xs text-gray-500">
            {i18n("Track business capital, selected inventory costs, and manual costs in one place.")}</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isLoading}
          aria-busy={isLoading}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-brand-border bg-white px-3 text-xs font-bold text-brand-red shadow-sm transition-all duration-200 hover:border-brand-red hover:bg-brand-light-bg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <LoadingSpinner decorative size="sm" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
          {isLoading ? i18n("Refreshing...") : i18n("Refresh")}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm"
        >
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
            <RotateCcw className="h-4 w-4 text-red-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-red-800">
              {i18n("Couldn't load capital & cost data")}</p>
            <p className="mt-0.5 wrap-break-word text-sm text-red-700">{i18n(error)}</p>
            <p className="mt-1 text-xs text-red-600/80">
              {i18n("If this persists right after a schema change, restart the dev server so the Prisma client picks up the new models.")}</p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-red-300 bg-white px-3 text-xs font-semibold text-red-700 transition hover:bg-red-100"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {i18n("Try again")}</button>
        </div>
      )}

      <CapitalCostSummaryCards
        summary={summary}
        productCost={productCost}
        currency={CURRENCY}
        loading={loadingCards}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <CapitalForm
          form={capitalForm}
          setForm={setCapitalForm}
          currency={CURRENCY}
          hasCapital={Boolean(capital)}
          isLoading={isLoading}
          isSaving={isSavingCapital}
          error={capitalError}
          note={capitalNote}
          onRefresh={() => void refresh()}
          onSubmit={handleCapitalSubmit}
        />
        <ProductCostCard
          productCost={productCost}
          currency={CURRENCY}
          isLoading={isLoading}
          busyId={busyProductCostId}
          onAdd={openProductPicker}
          onRemove={(item) => void handleRemoveProductCost(item)}
        />
      </div>

      {/* Other costs */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-brand-border bg-brand-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
                <Receipt className="h-4 w-4 text-brand-red" />
                {i18n("Other costs")}</h2>
              <p className="text-xs text-gray-500">
                {i18n("Manual costs you record by hand.")}{" "}
                {filterActive ? i18n("Filtered") : i18n("Showing")} {i18n("total:")}{" "}
                <span className="font-semibold text-gray-700">
                  {formatCurrency(filteredTotal, CURRENCY, locale)}
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateCost}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-red px-4 text-sm font-semibold text-white transition hover:bg-brand-red-hover"
            >
              <Plus className="h-4 w-4" />
              {i18n("Add other cost")}</button>
          </div>
        </div>

        <OtherCostFilters
          filters={filters}
          setFilters={setFilters}
          onApply={() => void applyFilters()}
          onReset={resetFilters}
          isLoading={listLoading}
        />

        {listError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {listError}
          </div>
        )}
        {listNote && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {listNote}
          </div>
        )}

        <OtherCostsTable
          costs={visibleCosts}
          currency={CURRENCY}
          busyId={busyId}
          isLoading={(isLoading && !isHydrated) || listLoading}
          onEdit={openEditCost}
          onDelete={(cost) => void handleDeleteCost(cost)}
        />
      </div>

      <CapitalCostActivity
        activity={activity}
        currency={CURRENCY}
        isLoading={isLoading && !isHydrated}
      />

      <OtherCostFormDrawer
        open={Boolean(editing)}
        mode={editing?.mode === "edit" ? "edit" : "create"}
        form={costForm}
        setForm={setCostForm}
        currency={CURRENCY}
        isSubmitting={isSubmittingCost}
        error={costDrawerError}
        onClose={closeCostDrawer}
        onSubmit={handleCostSubmit}
      />
      <ProductCostPickerDrawer
        open={productPickerOpen}
        options={productOptions}
        selectedProductIds={selectedProductIds}
        existingProductIds={(productCost?.items ?? []).map(
          (item) => item.productId,
        )}
        currency={CURRENCY}
        isLoading={isLoadingProductOptions}
        isSubmitting={isSavingProductCosts}
        error={productPickerError}
        onToggle={toggleProductSelection}
        onClose={closeProductPicker}
        onSubmit={() => void handleProductCostSubmit()}
      />
    </section>
  );
}
