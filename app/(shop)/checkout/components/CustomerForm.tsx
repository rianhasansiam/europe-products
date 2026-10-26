"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useId } from "react";
import Link from "@/lib/i18n/navigation";
import {
  AlertCircle,
  Building2,
  Hash,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Truck,
  User,
} from "lucide-react";

import type { DeliveryZone } from "@/features/checkout/api";
import { cn } from "@/lib/utils";

export type CustomerFormState = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  customerCity: string;
  deliveryZone: DeliveryZone | "";
  customerPostalCode: string;
  customerNote: string;
};

type CustomerFormProps = {
  form: CustomerFormState;
  onChange: <K extends keyof CustomerFormState>(
    field: K,
    value: CustomerFormState[K],
  ) => void;
  errors: Partial<Record<keyof CustomerFormState, string>>;
  isAuthenticated: boolean;
  emailRequired?: boolean;
  profileStatus: "idle" | "loading" | "loaded" | "error";
  onRetryProfile: () => void;
};

export default function CustomerForm({
  form,
  onChange,
  errors,
  isAuthenticated,
  emailRequired = false,
  profileStatus,
  onRetryProfile,
}: CustomerFormProps) {
  const i18n = useInterfaceTranslations("InterfaceCheckoutComponentsCustomerForm");
  const isProfileLoading = isAuthenticated && profileStatus === "loading";

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">{i18n("Delivery details")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isAuthenticated
              ? i18n("Pulled from your profile - update anything that's changed.")
              : i18n("We use these details only to deliver your order.")}
          </p>
        </div>
        {isAuthenticated && (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold",
              isProfileLoading
                ? "bg-muted text-muted-foreground"
                : "bg-success-surface text-success",
            )}
          >
            {isProfileLoading ? i18n("Loading profile...") : i18n("Auto-filled")}
          </span>
        )}
      </header>

      {isAuthenticated && profileStatus === "error" && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {i18n("We couldn't load your saved profile. You can still fill the form in manually.")}</span>
          <button
            type="button"
            onClick={onRetryProfile}
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
          >
            {i18n("Retry")}</button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          icon={<User className="h-4 w-4" />}
          label={i18n("Full name")}
          value={form.customerName}
          onChange={(value) => onChange("customerName", value)}
          error={i18n(errors.customerName)}
          autoComplete="name"
          disabled={isProfileLoading}
          required
        />
        <Field
          icon={<Phone className="h-4 w-4" />}
          label={i18n("Phone number")}
          value={form.customerPhone}
          onChange={(value) => onChange("customerPhone", value)}
          error={i18n(errors.customerPhone)}
          autoComplete="tel"
          inputMode="tel"
          disabled={isProfileLoading}
          required
        />
        <div className="sm:col-span-2">
          {isAuthenticated ? (
            <EmailField email={form.customerEmail} loading={isProfileLoading} />
          ) : (
            <Field
              icon={<Mail className="h-4 w-4" />}
              label={emailRequired ? i18n("Email") : i18n("Email (optional)")}
              value={form.customerEmail}
              onChange={(value) => onChange("customerEmail", value)}
              error={i18n(errors.customerEmail)}
              autoComplete="email"
              inputMode="email"
              type="email"
              required={emailRequired}
            />
          )}
        </div>
        <div className="sm:col-span-2">
          <FieldTextarea
            icon={<MapPin className="h-4 w-4" />}
            label={i18n("Delivery address")}
            value={form.customerAddress}
            onChange={(value) => onChange("customerAddress", value)}
            error={i18n(errors.customerAddress)}
            autoComplete="street-address"
            disabled={isProfileLoading}
            required
            placeholder={i18n("House / Road / Area")}
          />
        </div>
        <Field
          icon={<Building2 className="h-4 w-4" />}
          label={i18n("City / district")}
          value={form.customerCity}
          onChange={(value) => onChange("customerCity", value)}
          error={i18n(errors.customerCity)}
          autoComplete="address-level2"
          disabled={isProfileLoading}
        />
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-body">
            <span className="text-muted-foreground">
              <Truck className="h-4 w-4" />
            </span>
            {i18n("Delivery area")}<span className="text-destructive">*</span>
          </span>
          <select
            value={form.deliveryZone}
            onChange={(event) =>
              onChange("deliveryZone", event.target.value as CustomerFormState["deliveryZone"])
            }
            disabled={isProfileLoading}
            required
            aria-invalid={Boolean(errors.deliveryZone)}
            aria-describedby={errors.deliveryZone ? "delivery-area-error" : undefined}
            className={cn(
              "h-11 w-full rounded-xl border border-input bg-card px-3 text-base text-foreground outline-none transition-all duration-200 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
              errors.deliveryZone && "border-destructive/25 bg-destructive/10",
            )}
          >
            <option value="" disabled>{i18n("Select delivery area")}</option>
            <option value="INSIDE_DHAKA">{i18n("Delivery inside Dhaka")}</option>
            <option value="OUTSIDE_DHAKA">{i18n("Delivery outside Dhaka")}</option>
          </select>
          {errors.deliveryZone && (
            <p id="delivery-area-error" className="mt-1.5 text-xs font-medium text-destructive">{i18n(errors.deliveryZone)}</p>
          )}
        </label>
        <Field
          icon={<Hash className="h-4 w-4" />}
          label={i18n("Postal code")}
          value={form.customerPostalCode}
          onChange={(value) => onChange("customerPostalCode", value)}
          error={i18n(errors.customerPostalCode)}
          autoComplete="postal-code"
          inputMode="text"
          disabled={isProfileLoading}
        />
        <div className="sm:col-span-2">
          <FieldTextarea
            icon={<MessageSquare className="h-4 w-4" />}
            label={i18n("Additional note (optional)")}
            value={form.customerNote}
            onChange={(value) => onChange("customerNote", value)}
            error={i18n(errors.customerNote)}
            placeholder={i18n("Delivery instructions, gate code, preferred time...")}
          />
        </div>
      </div>
    </section>
  );
}

/**
 * Read-only email field. The email is linked to the authenticated
 * account and can only be changed from the profile page, so it's
 * rendered locked (visible but not editable) with a helper note and a
 * shortcut to the profile settings.
 */
function EmailField({
  email,
  loading,
}: {
  email: string;
  loading: boolean;
}) {
  const i18n = useInterfaceTranslations("InterfaceCheckoutComponentsCustomerForm");
  return (
    <div className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-body">
        <span className="text-muted-foreground">
          <Mail className="h-4 w-4" />
        </span>
        {i18n("Email")}<Lock className="h-3 w-3 text-muted-foreground" />
      </span>
      <div className="relative" dir="ltr">
        <input
          value={loading ? "" : email}
          type="email"
          readOnly
          disabled
          aria-label={i18n("Email (linked to your account)")}
          placeholder={loading ? i18n("Loading your email...") : undefined}
          autoComplete="email"
          className={cn(
            "h-11 w-full cursor-not-allowed rounded-xl border border-border bg-muted px-3 pe-10 text-sm font-medium text-body outline-none",
          )}
        />
        <Lock className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
        <span>
          {i18n("Email is linked to your account. Update it from your profile page if needed.")}</span>
        <Link
          href="/profile?tab=settings"
          className="font-semibold text-primary underline-offset-2 hover:text-primary-hover hover:underline"
        >
          {i18n("Update Profile")}</Link>
      </p>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  error,
  autoComplete,
  inputMode,
  type = "text",
  required,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete?: string;
  inputMode?: "text" | "tel" | "email";
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const errorId = useId();
  const i18n = useInterfaceTranslations("InterfaceCheckoutComponentsCustomerForm");
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-body">
        <span className="text-muted-foreground">{icon}</span>
        {i18n(label)}
        {required && <span className="text-destructive">*</span>}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        aria-required={required}
        className={cn(
          "h-11 w-full rounded-xl border bg-card px-3 text-base text-foreground outline-none transition-all duration-200",
          "focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/30",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
          error
            ? "border-destructive/25 focus-visible:border-destructive focus-visible:ring-destructive/20"
            : "border-input",
        )}
      />
      {error && (
        <span id={errorId} className="mt-1 block text-xs font-medium text-destructive">
          {i18n(error)}
        </span>
      )}
    </label>
  );
}

function FieldTextarea({
  icon,
  label,
  value,
  onChange,
  error,
  autoComplete,
  required,
  placeholder,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  const errorId = useId();
  const i18n = useInterfaceTranslations("InterfaceCheckoutComponentsCustomerForm");
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-body">
        <span className="text-muted-foreground">{icon}</span>
        {i18n(label)}
        {required && <span className="text-destructive">*</span>}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        autoComplete={autoComplete}
        placeholder={i18n(placeholder)}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        aria-required={required}
        className={cn(
          "min-h-[88px] w-full rounded-xl border bg-card px-3 py-2 text-base text-foreground outline-none transition-all duration-200",
          "focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/30",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
          error
            ? "border-destructive/25 focus-visible:border-destructive focus-visible:ring-destructive/20"
            : "border-input",
        )}
      />
      {error && (
        <span id={errorId} className="mt-1 block text-xs font-medium text-destructive">
          {i18n(error)}
        </span>
      )}
    </label>
  );
}
