/** Recoverable drafts exist only for an explicit switch, in this tab, for ten minutes. */
export const DRAFT_EVENT = "bangbuy:prepare-language-switch";
export const DRAFT_PREFIX = "bangbuy:locale-draft:";
const MAX_AGE = 10 * 60 * 1000;
const MAX_DRAFT_BYTES = 64 * 1024;
const dirtyForms = new WeakSet<HTMLFormElement>();

/** An unresolved session cannot safely capture or restore identity-bound fields. */
export function languageDraftIdentity(status: "loading" | "authenticated" | "unauthenticated", userId?: string | null): string | null {
  if (status === "loading") return null;
  if (status === "unauthenticated") return "guest";
  return typeof userId === "string" && userId ? `user:${userId}` : null;
}

export function languageDraftKey(name: string, pathname: string, search: string, identity: string): string {
  return `v2:${encodeURIComponent(identity)}:${encodeURIComponent(name)}:${pathname}${search}`;
}

/** Enforce exclusions at runtime as well as at each form's explicit allowlist. */
export function isRecoverableDraftField(field: string): boolean {
  return !["__proto__", "constructor", "prototype"].includes(field)
    && !/password|passphrase|card|cvv|cvc|security.?code|token|secret|credential|payment.?intent|(?:^|[_-])(?:file|upload)(?:$|[_-])/i.test(field);
}

export function isRecoverableDraftValue(value: unknown): boolean {
  return value === null || typeof value === "string" || typeof value === "boolean"
    || typeof value === "number" && Number.isFinite(value)
    || Array.isArray(value) && value.every((item) => item === null || typeof item === "string" || typeof item === "boolean" || typeof item === "number" && Number.isFinite(item));
}

function hasDraftValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "" && value !== false
    && (!Array.isArray(value) || value.length > 0);
}

/** Multi-step forms may retain sensitive state while its inputs are unmounted. */
export function hasUnrecoverableDraftState(value: object, safeFields: readonly PropertyKey[]): boolean {
  if (Object.entries(value).some(([field, entry]) => !isRecoverableDraftField(field) && hasDraftValue(entry))) return true;
  const fields = value as Record<PropertyKey, unknown>;
  return safeFields.some((field) => (typeof field === "symbol" || !isRecoverableDraftField(String(field)) || !isRecoverableDraftValue(fields[field])) && hasDraftValue(fields[field]));
}

export function restoreLanguageDraftFields<T extends object>(current: T, initial: T, draft: Record<string, unknown>, safeFields: readonly (keyof T)[]): T {
  const restored = Object.fromEntries(safeFields.filter((field) =>
    isRecoverableDraftField(String(field)) && Object.hasOwn(draft, String(field))
    && isRecoverableDraftValue(draft[field as string]) && typeof draft[field as string] === typeof current[field]
    && JSON.stringify(current[field]) === JSON.stringify(initial[field]),
  ).map((field) => [field, draft[field as string]]));
  return { ...current, ...restored };
}

function recoverableFields(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([field, entry]) => isRecoverableDraftField(field) && isRecoverableDraftValue(entry)));
}

export function markLanguageFormDirty(form: HTMLFormElement): void {
  dirtyForms.add(form);
}

export function resetLanguageFormDirty(form: HTMLFormElement): void {
  dirtyForms.delete(form);
}

type FormControlSnapshot = {
  tagName: string; type?: string; value?: string; defaultValue?: string;
  checked?: boolean; defaultChecked?: boolean; multiple?: boolean;
  options?: ArrayLike<{ selected: boolean; defaultSelected: boolean }>;
};

/** Native defaults supplement real input/change events for non-React controls. */
export function isLanguageFormControlDirty(control: FormControlSnapshot): boolean {
  if (control.tagName === "SELECT" && control.options) {
    const options = Array.from(control.options);
    if (control.multiple) return options.some((option) => option.selected !== option.defaultSelected);
    const selected = options.findIndex((option) => option.selected);
    const lastDefault = options.reduce((index, option, position) => option.defaultSelected ? position : index, -1);
    return selected !== (lastDefault < 0 && options.length ? 0 : lastDefault);
  }
  if (control.tagName === "INPUT") {
    if (["hidden", "submit", "button", "reset"].includes(control.type ?? "")) return false;
    if (["checkbox", "radio"].includes(control.type ?? "")) return control.checked !== control.defaultChecked;
    return control.value !== control.defaultValue;
  }
  return control.tagName === "TEXTAREA" && control.value !== control.defaultValue;
}

export type DraftPreparation = { failed: boolean; unrecoverable: boolean; blocked: boolean; savedKeys: string[] };

export function prepareLanguageDrafts(): DraftPreparation {
  const detail: DraftPreparation = { failed: false, unrecoverable: false, blocked: false, savedKeys: [] };
  window.dispatchEvent(new CustomEvent(DRAFT_EVENT, { detail }));
  // Passwords and payment details are never written to storage. Warn before leaving them.
  for (const input of document.querySelectorAll<HTMLInputElement>("input")) {
    const marker = `${input.type} ${input.name} ${input.id} ${input.autocomplete}`;
    if (input.value && /password|cc-|card.?number|cvc|cvv|security.?code|new-password|current-password/i.test(marker) || input.type === "file" && !!input.files?.length) detail.unrecoverable = true;
  }
  // Forms without recovery opt-in can contain files and custom rich editors.
  for (const form of document.querySelectorAll<HTMLFormElement>("form:not([data-locale-recoverable])")) {
    if (dirtyForms.has(form) || Array.from(form.elements).some((element) => isLanguageFormControlDirty(element as unknown as FormControlSnapshot))) detail.unrecoverable = true;
  }
  return detail;
}

export function discardPreparedDrafts(preparation: DraftPreparation): void {
  for (const key of preparation.savedKeys) {
    try { sessionStorage.removeItem(DRAFT_PREFIX + key); } catch { /* Storage may be unavailable. */ }
  }
}

/** Clear prior identities, including legacy unscoped drafts, after auth resolves. */
export function discardOtherIdentityDrafts(identity: string): void {
  try {
    const keys = Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index));
    for (const key of keys) {
      if (!key?.startsWith(DRAFT_PREFIX)) continue;
      try {
        const draft = JSON.parse(sessionStorage.getItem(key) ?? "null");
        if (draft?.identity !== identity || !Number.isFinite(draft.at) || draft.at > Date.now() || Date.now() - draft.at > MAX_AGE) sessionStorage.removeItem(key);
      } catch { sessionStorage.removeItem(key); }
    }
  } catch { /* Recovery capture will report unavailable storage if needed. */ }
}

export function writeLanguageDraft(key: string, value: Record<string, unknown>, identity: string): void {
  const serialized = JSON.stringify({ at: Date.now(), identity, value: recoverableFields(value) });
  if (new TextEncoder().encode(serialized).byteLength > MAX_DRAFT_BYTES) throw new Error("Language recovery draft is too large.");
  sessionStorage.setItem(DRAFT_PREFIX + key, serialized);
}

export function readLanguageDraft(key: string, identity: string): Record<string, unknown> | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_PREFIX + key);
    if (!raw) return null;
    sessionStorage.removeItem(DRAFT_PREFIX + key);
    const draft = JSON.parse(raw);
    if (draft.identity !== identity || typeof draft.at !== "number" || !Number.isFinite(draft.at) || draft.at > Date.now() || Date.now() - draft.at > MAX_AGE || !draft.value || typeof draft.value !== "object" || Array.isArray(draft.value)) return null;
    return recoverableFields(draft.value);
  } catch { return null; }
}
