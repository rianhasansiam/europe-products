"use client";

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { DRAFT_EVENT, discardOtherIdentityDrafts, hasUnrecoverableDraftState, isRecoverableDraftField, isRecoverableDraftValue, languageDraftIdentity, languageDraftKey, readLanguageDraft, restoreLanguageDraftFields, writeLanguageDraft, type DraftPreparation } from "@/lib/i18n/drafts";
import { stripLocalePrefix } from "@/lib/i18n/paths";
import { useSession } from "@/lib/auth/use-app-session";

/** Explicit field allowlist: never pass passwords, card details, payment tokens or files. */
export function useLocaleDraft<T extends object>(name: string, value: T, setValue: Dispatch<SetStateAction<T>>, safeFields: readonly (keyof T)[]) {
  const { data: session, status } = useSession();
  const identity = languageDraftIdentity(status, session?.user?.id);
  const initial = useRef(value);
  const state = useRef({ value, setValue, safeFields });
  useEffect(() => { state.current = { value, setValue, safeFields }; });
  useEffect(() => {
    if (!identity) {
      const guard = (event: Event) => { (event as CustomEvent<DraftPreparation>).detail.blocked = true; };
      window.addEventListener(DRAFT_EVENT, guard);
      return () => window.removeEventListener(DRAFT_EVENT, guard);
    }
    discardOtherIdentityDrafts(identity);
    const key = languageDraftKey(name, stripLocalePrefix(window.location.pathname), window.location.search, identity);
    const draft = readLanguageDraft(key, identity);
    if (draft) {
      // A delayed session response must not overwrite edits made since mount.
      state.current.setValue((current) => restoreLanguageDraftFields(current, initial.current, draft, state.current.safeFields));
    }
    const capture = (event: Event) => {
      const { value: current, safeFields: fields } = state.current;
      const detail = (event as CustomEvent<DraftPreparation>).detail;
      if (hasUnrecoverableDraftState(current, fields)) detail.unrecoverable = true;
      const allowed = Object.fromEntries(fields.filter((field) => isRecoverableDraftField(String(field)) && isRecoverableDraftValue(current[field])).map((field) => [field, current[field]]));
      try { writeLanguageDraft(key, allowed, identity); detail.savedKeys.push(key); } catch { detail.failed = true; }
    };
    window.addEventListener(DRAFT_EVENT, capture);
    return () => window.removeEventListener(DRAFT_EVENT, capture);
  }, [name, identity]);
}

/** Keep an in-flight checkout or form submission on the current page until it settles. */
export function useLocaleSwitchGuard(busy: boolean) {
  useEffect(() => {
    const guard = (event: Event) => { if (busy) (event as CustomEvent<DraftPreparation>).detail.blocked = true; };
    window.addEventListener(DRAFT_EVENT, guard);
    return () => window.removeEventListener(DRAFT_EVENT, guard);
  }, [busy]);
}
