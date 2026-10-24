"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";

import { toast } from "@/lib/feedback";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Mail,
  MapPin,
  Phone,
  Save,
  User,
} from "lucide-react";

import {
  updateProfileOnServer,
  type ProfilePatch,
  type ProfileUser,
} from "@/features/profile/api";
import {
  EMAIL_REGEX,
  FIELD_LIMITS,
  PHONE_REGEX,
} from "@/lib/auth/policy";

import FloatField from "@/app/(auth)/_components/FloatField";
import ImageUploader from "@/components/ui/ImageUploader";
import { ButtonLoader } from "@/components/ui/loading";
import { useLocaleDraft, useLocaleSwitchGuard } from "@/components/i18n/useLocaleDraft";

type SettingsTabProps = {
  user: ProfileUser;
  onUpdated: (user: ProfileUser) => void;
};

type FormState = {
  name: string;
  phone: string;
  city: string;
  image: string;
};

type SubmitState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success" }
  | { status: "error"; message: string };

function toFormState(user: ProfileUser): FormState {
  return {
    name: user.name ?? "",
    phone: user.phone ?? "",
    city: user.city ?? "",
    image: user.image ?? "",
  };
}

/**
 * Compare the form against the original user record and return only
 * the fields that actually changed. Skips empty strings unless the
 * original had a value (clearing) so we don't push redundant updates.
 */
function buildPatch(user: ProfileUser, form: FormState): ProfilePatch {
  const patch: ProfilePatch = {};

  if (form.name.trim() !== (user.name ?? "")) {
    patch.name = form.name.trim();
  }
  if (form.phone.trim() !== (user.phone ?? "")) {
    patch.phone = form.phone.trim();
  }
  if (form.city.trim() !== (user.city ?? "")) {
    patch.city = form.city.trim();
  }
  if (form.image.trim() !== (user.image ?? "")) {
    patch.image = form.image.trim();
  }

  return patch;
}

function validate(form: FormState): Record<keyof FormState, boolean | null> {
  return {
    name:
      form.name.length === 0
        ? null
        : form.name.trim().length >= FIELD_LIMITS.NAME_MIN &&
          form.name.length <= FIELD_LIMITS.NAME_MAX,
    phone:
      form.phone.length === 0
        ? null
        : form.phone.length >= FIELD_LIMITS.PHONE_MIN &&
          form.phone.length <= FIELD_LIMITS.PHONE_MAX &&
          PHONE_REGEX.test(form.phone),
    city:
      form.city.length === 0
        ? null
        : form.city.trim().length >= FIELD_LIMITS.CITY_MIN &&
          form.city.length <= FIELD_LIMITS.CITY_MAX,
    image:
      form.image.length === 0
        ? null
        : /^https?:\/\//.test(form.image) && form.image.length <= 2048,
  };
}

/**
 * "Settings" tab — edit personal info.
 *
 * Email is shown as read-only because changing it touches identity
 * and we don't have an email-verification flow yet. The form streams
 * field-level validation through the same FloatField the auth pages
 * use, so the styling and accessibility behaviour stay consistent.
 */
export default function SettingsTab({ user, onUpdated }: SettingsTabProps) {
  const i18n = useInterfaceTranslations("InterfaceProfileComponentsSettingsTab");
  const [form, setForm] = useState<FormState>(() => toFormState(user));
  useLocaleDraft("profile-settings", form, setForm, ["name", "phone", "city", "image"]);
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
  });
  useLocaleSwitchGuard(submitState.status === "saving");

  const validity = useMemo(() => validate(form), [form]);
  const patch = useMemo(() => buildPatch(user, form), [user, form]);
  const dirtyKeys = Object.keys(patch);
  const dirty = dirtyKeys.length > 0;

  const blockingError = useMemo(() => {
    if (!dirty) return null;
    for (const key of dirtyKeys) {
      const isValid = validity[key as keyof FormState];
      if (isValid === false) return "Please review the highlighted fields.";
    }
    return null;
  }, [dirty, dirtyKeys, validity]);

  const handleChange = (key: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSubmitState((prev) =>
      prev.status === "success" ? { status: "idle" } : prev,
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dirty || blockingError) return;

    setSubmitState({ status: "saving" });

    try {
      const updated = await updateProfileOnServer(patch);
      onUpdated(updated);
      setSubmitState({ status: "success" });
      toast.success(i18n("Profile updated successfully"));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save changes.";
      setSubmitState({ status: "error", message });
      toast.error(i18n(message));
    }
  };

  const handleReset = () => {
    setForm(toFormState(user));
    setSubmitState({ status: "idle" });
  };

  // Email gets a read-only render because it's locked. The FloatField
  // matches the rest of the form so the layout stays uniform.
  const emailLooksValid = EMAIL_REGEX.test(user.email);

  return (
    <form
      data-locale-recoverable
      onSubmit={handleSubmit}
      className="rounded-2xl border border-brand-border bg-brand-white p-4 shadow-sm sm:rounded-3xl sm:p-6"
    >
      <header className="mb-5 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-light-bg text-brand-black">
          <User className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900 sm:text-lg">
            {i18n("Personal info")}</h2>
          <p className="text-xs text-gray-500">
            {i18n("Update the details we use for your account and checkout.")}</p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <FloatField
          icon={<User className="h-4 w-4" />}
          label={i18n("Full name")}
          value={form.name}
          onChange={handleChange("name")}
          autoComplete="name"
          maxLength={FIELD_LIMITS.NAME_MAX}
          valid={validity.name}
        />
        <ReadOnlyField
          icon={<Mail className="h-4 w-4" />}
          label={i18n("Email address")}
          value={user.email}
          help="Email is locked. Contact support to change it."
          valid={emailLooksValid}
        />
        <FloatField
          icon={<Phone className="h-4 w-4" />}
          label={i18n("Phone number")}
          value={form.phone}
          onChange={handleChange("phone")}
          autoComplete="tel"
          maxLength={FIELD_LIMITS.PHONE_MAX}
          valid={validity.phone}
        />
        <FloatField
          icon={<MapPin className="h-4 w-4" />}
          label={i18n("City")}
          value={form.city}
          onChange={handleChange("city")}
          autoComplete="address-level2"
          maxLength={FIELD_LIMITS.CITY_MAX}
          valid={validity.city}
        />
        <div className="sm:col-span-2">
          <ImageUploader
            category="users"
            label={i18n("Profile picture")}
            value={form.image}
            onChange={handleChange("image")}
            disabled={submitState.status === "saving"}
          />
          <p className="mt-1 text-[11px] text-gray-500">
            {i18n("Upload a photo, or leave blank to use your initials.")}</p>
        </div>
      </div>

      {submitState.status === "error" && (
        <div className="mt-5 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {i18n(submitState.message)}
        </div>
      )}

      {submitState.status === "success" && (
        <div className="mt-5 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {i18n("Profile updated successfully.")}</div>
      )}

      {blockingError && submitState.status !== "saving" && (
        <p className="mt-3 text-xs font-semibold text-rose-600">
          {blockingError}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-500">
          {dirty
            ? i18n("{count, plural, one {# pending change.} other {# pending changes.}}", { count: dirtyKeys.length })
            : i18n("All changes saved.")}
        </p>
        <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:w-auto sm:items-center">
          <button
            type="button"
            onClick={handleReset}
            disabled={!dirty || submitState.status === "saving"}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-brand-border bg-brand-white px-4 text-sm font-bold text-brand-black transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-red hover:bg-brand-light-bg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:w-auto"
          >
            {i18n("Reset")}</button>
          <button
            type="submit"
            disabled={
              !dirty || submitState.status === "saving" || Boolean(blockingError)
            }
            aria-busy={submitState.status === "saving"}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-brand-red px-5 text-sm font-bold text-brand-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-xl disabled:cursor-not-allowed disabled:bg-gray-300 disabled:hover:translate-y-0 sm:w-auto"
          >
            {submitState.status === "saving" ? (
              <ButtonLoader label={i18n("Saving...")} />
            ) : (
              <>
                <Save className="h-4 w-4" />
                {i18n("Save changes")}</>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * Read-only equivalent of `FloatField` used for fields the user can
 * see but not edit (e.g. email). Keeps visual parity with the rest of
 * the form without needing to layer a clickable mask over the real
 * input.
 */
function ReadOnlyField({
  icon,
  label,
  value,
  help,
  valid,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  help?: string;
  valid?: boolean;
}) {
  const i18n = useInterfaceTranslations("InterfaceProfileComponentsSettingsTab");
  return (
    <div>
      <div className="relative rounded-xl border border-brand-border bg-brand-light-bg shadow-sm">
        <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-brand-text-muted">
          {icon}
        </span>
        <span className="absolute -top-2 start-3 bg-brand-white px-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-black">
          {i18n(label)}
        </span>
        <div className="flex h-12 items-center ps-9 pe-9 text-sm font-medium text-gray-700">
          <bdi className="truncate" dir="ltr">{value}</bdi>
        </div>
        {valid && (
          <CheckCircle2 className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
        )}
      </div>
      {help && <p className="mt-1 text-[11px] text-gray-500">{help}</p>}
    </div>
  );
}
