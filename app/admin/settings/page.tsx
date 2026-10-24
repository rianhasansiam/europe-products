"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RotateCcw, Ticket } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";

import {
  removePromoCode,
  setAdminSettings,
  setAdminSettingsError,
  setAdminSettingsLoading,
  setStoreSettings,
  upsertPromoCode,
} from "@/store/slices/admin-settings.slice";
import type { AppDispatch, RootState } from "@/store";
import {
  buildPromoForm,
  buildSettingsForm,
  createPromoCode,
  deletePromoCode,
  EMPTY_PROMO_FORM,
  EMPTY_SETTINGS_FORM,
  fetchPromoCodes,
  fetchStoreSettings,
  fromDateTimeLocal,
  parseNumberField,
  parseOptionalInt,
  parseOptionalNumber,
  updatePromoCode,
  updateStoreSettings,
  type PromoCodeRow,
  type PromoFormState,
  type SettingsFormState,
} from "@/features/admin-settings/api";
import {
  confirmMajorAction,
  notifyActionError,
  notifyActionSuccess,
} from "@/lib/admin-feedback";
import { useAnimatedRemoval } from "@/hooks/useAnimatedRemoval";

import SettingsSummaryCards from "./components/SettingsSummaryCards";
import StorePricingForm from "./components/StorePricingForm";
import PromoCodesTable from "./components/PromoCodesTable";
import PromoFormDrawer from "./components/PromoFormDrawer";

export default function AdminSettingsPage() {
  const i18n = useInterfaceTranslations("AdminAdminSettingsPage");
  const dispatch = useDispatch<AppDispatch>();
  const settings = useSelector((s: RootState) => s.adminSettings.settings);
  const promos = useSelector((s: RootState) => s.adminSettings.promos);
  const isHydrated = useSelector((s: RootState) => s.adminSettings.isHydrated);
  const isLoading = useSelector((s: RootState) => s.adminSettings.isLoading);
  const error = useSelector((s: RootState) => s.adminSettings.error);

  const [settingsForm, setSettingsForm] = useState<SettingsFormState>(() =>
    settings ? buildSettingsForm(settings) : EMPTY_SETTINGS_FORM,
  );
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsNote, setSettingsNote] = useState<string | null>(null);

  const [editing, setEditing] = useState<
    { mode: "create" } | { mode: "edit"; promo: PromoCodeRow } | null
  >(null);
  const [promoForm, setPromoForm] = useState<PromoFormState>(EMPTY_PROMO_FORM);
  const [isSubmittingPromo, setIsSubmittingPromo] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoNote, setPromoNote] = useState<string | null>(null);
  const [busyPromoId, setBusyPromoId] = useState<string | null>(null);
  const { visibleItems: visiblePromos, queueRemoval: queuePromoRemoval } =
    useAnimatedRemoval({
      items: promos,
      getId: (promo) => promo.id,
    });

  /* ---------------------------- Hydration ---------------------------- */

  const refresh = useCallback(async () => {
    await Promise.resolve();

    dispatch(setAdminSettingsLoading(true));
    dispatch(setAdminSettingsError(null));
    try {
      const [storeSettings, promoCodes] = await Promise.all([
        fetchStoreSettings(),
        fetchPromoCodes(),
      ]);
      dispatch(setAdminSettings({ settings: storeSettings, promos: promoCodes }));
      setSettingsForm(buildSettingsForm(storeSettings));
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Failed to load settings.";
      dispatch(setAdminSettingsError(message));
    } finally {
      dispatch(setAdminSettingsLoading(false));
    }
  }, [dispatch]);

  useEffect(() => {
    if (isHydrated) return;
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isHydrated, refresh]);

  /* ---------------------------- Settings form ------------------------ */

  const handleSettingsSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setSettingsError(null);
    setSettingsNote(null);

    try {
      const taxPercent = parseNumberField(
        settingsForm.taxRatePercent || "0",
        "Tax rate",
      );
      if (taxPercent > 100) {
        throw new Error(i18n("Tax rate cannot exceed 100%."));
      }
      const standardShippingFee = parseNumberField(
        settingsForm.standardShippingFee || "0",
        "Delivery inside Dhaka",
      );
      const expressShippingFee = parseNumberField(
        settingsForm.expressShippingFee || "0",
        "Delivery outside Dhaka",
      );
      const freeShippingThreshold = parseNumberField(
        settingsForm.freeShippingThreshold || "0",
        "Free shipping threshold",
      );
      setIsSavingSettings(true);
      const updated = await updateStoreSettings({
        taxRate: taxPercent / 100,
        standardShippingFee,
        expressShippingFee,
        freeShippingThreshold,
      });
      dispatch(setStoreSettings(updated));
      setSettingsForm(buildSettingsForm(updated));
      const message = i18n("Store settings saved.");
      setSettingsNote(message);
      notifyActionSuccess(message);
    } catch (mutation) {
      const message =
        mutation instanceof Error ? mutation.message : "Failed to save settings.";
      setSettingsError(message);
      notifyActionError(mutation, "Failed to save settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  /* ---------------------------- Promo CRUD --------------------------- */

  const openCreatePromo = () => {
    setEditing({ mode: "create" });
    setPromoForm(EMPTY_PROMO_FORM);
    setPromoError(null);
  };

  const openEditPromo = (promo: PromoCodeRow) => {
    setEditing({ mode: "edit", promo });
    setPromoForm(buildPromoForm(promo));
    setPromoError(null);
  };

  const closePromoPanel = () => {
    setEditing(null);
    setPromoError(null);
  };

  const handlePromoSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!editing) return;
    setPromoError(null);
    setPromoNote(null);

    try {
      const code = promoForm.code.trim();
      if (!code) throw new Error(i18n("Promo code is required."));

      const value = parseNumberField(promoForm.value || "0", "Discount value");
      if (promoForm.discountType === "PERCENT" && value > 100) {
        throw new Error(i18n("Percent discount must be between 0 and 100."));
      }

      const minOrder = parseOptionalNumber(promoForm.minOrder, "Minimum order");
      const maxDiscount = parseOptionalNumber(
        promoForm.maxDiscount,
        "Maximum discount",
      );
      const usageLimit = parseOptionalInt(promoForm.usageLimit, "Usage limit");

      const startsAt = fromDateTimeLocal(promoForm.startsAt);
      const endsAt = fromDateTimeLocal(promoForm.endsAt);
      if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
        throw new Error(i18n("End date must be after the start date."));
      }

      const body = {
        code,
        description: promoForm.description.trim() || null,
        discountType: promoForm.discountType,
        value,
        minOrder,
        maxDiscount,
        startsAt,
        endsAt,
        usageLimit,
        status: promoForm.status,
      };

      setIsSubmittingPromo(true);
      const promo =
        editing.mode === "create"
          ? await createPromoCode(body)
          : await updatePromoCode(editing.promo.id, body);
      dispatch(upsertPromoCode(promo));
      const message =
        editing.mode === "create"
          ? `Promo code "${promo.code}" created.`
          : `Promo code "${promo.code}" updated.`;
      setPromoNote(message);
      notifyActionSuccess(message);
      closePromoPanel();
    } catch (mutation) {
      const message =
        mutation instanceof Error ? mutation.message : "Failed to save promo.";
      setPromoError(message);
      notifyActionError(mutation, "Failed to save promo.");
    } finally {
      setIsSubmittingPromo(false);
    }
  };

  const handleDeletePromo = async (promo: PromoCodeRow) => {
    const confirmed = await confirmMajorAction({
      title: `Delete promo code "${promo.code}"?`,
      description: i18n("This action cannot be undone."),
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;

    queuePromoRemoval(
      promo.id,
      async () => {
        setPromoError(null);
        setPromoNote(null);
        setBusyPromoId(promo.id);

        try {
          await deletePromoCode(promo.id);
          dispatch(removePromoCode(promo.id));
          setPromoNote(`Promo code "${promo.code}" deleted.`);
          notifyActionSuccess(`Promo code "${promo.code}" deleted.`);
        } catch (mutation) {
          const message =
            mutation instanceof Error ? mutation.message : "Failed to delete promo.";
          setPromoError(message);
          throw new Error(message);
        } finally {
          setBusyPromoId(null);
        }
      },
      (error) => {
        notifyActionError(error, "Failed to delete promo.");
      },
    );
  };

  const totals = useMemo(() => {
    let active = 0;
    let used = 0;
    for (const promo of promos) {
      if (promo.status === "ACTIVE") active += 1;
      used += promo.usedCount;
    }
    return { active, used };
  }, [promos]);

  return (
    <section className="space-y-6">
      {/* Page-level load error: visible no matter which card renders. */}
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
              {i18n("Couldn't load settings")}</p>
            <p className="mt-0.5 wrap-break-word text-sm text-red-700">{i18n(error)}</p>
            <p className="mt-1 text-xs text-red-600/80">
              {i18n("The API responded with an error. If this persists right after a schema change, restart the dev server so the Prisma client picks up the new models.")}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void refresh();
            }}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-red-300 bg-white px-3 text-xs font-semibold text-red-700 transition hover:bg-red-100"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {i18n("Try again")}</button>
        </div>
      )}

      <StorePricingForm
        form={settingsForm}
        setForm={setSettingsForm}
        hasSettings={Boolean(settings)}
        isLoading={isLoading}
        isSaving={isSavingSettings}
        settingsError={settingsError}
        settingsNote={settingsNote}
        onRefresh={() => {
          void refresh();
        }}
        onSubmit={handleSettingsSubmit}
      />

      {/* Bottom: promo codes */}
      <div className="space-y-4">
        <SettingsSummaryCards
          promoCount={promos.length}
          activeCount={totals.active}
          usedCount={totals.used}
        />

        <div className="rounded-2xl border border-brand-border bg-brand-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
                <Ticket className="h-4 w-4 text-brand-red" />
                {i18n("Promo codes")}</h2>
              <p className="text-xs text-gray-500">
                {i18n("Customers redeem these at the cart. Codes are case-insensitive.")}</p>
            </div>

            <button
              type="button"
              onClick={openCreatePromo}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-red px-4 text-sm font-semibold text-white transition hover:bg-brand-red-hover"
            >
              <Plus className="h-4 w-4" />
              {i18n("New promo code")}</button>
          </div>
        </div>

        {promoError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {promoError}
          </div>
        )}
        {promoNote && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {promoNote}
          </div>
        )}

        <PromoCodesTable
          promos={visiblePromos}
          currency={settings?.currency ?? "USD"}
          busyPromoId={busyPromoId}
          onEdit={openEditPromo}
          onDelete={(promo) => {
            void handleDeletePromo(promo);
          }}
        />
      </div>

      <PromoFormDrawer
        open={Boolean(editing)}
        mode={editing?.mode === "edit" ? "edit" : "create"}
        form={promoForm}
        setForm={setPromoForm}
        isSubmitting={isSubmittingPromo}
        onClose={closePromoPanel}
        onSubmit={handlePromoSubmit}
      />
    </section>
  );
}
