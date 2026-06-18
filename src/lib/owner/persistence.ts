/**
 * Owner-form draft persistence.
 *
 * The form shell only ever calls the PersistenceLayer interface — so swapping
 * localStorage for Supabase later (the `owner_submissions` table + edge fn) is
 * a single-file change with no other touch points.
 */
import type { AnswerMap } from "./answerTypes";

/** Bump when the form's field ids / shape change incompatibly — old drafts
 *  are then discarded on load rather than resumed against a changed config. */
export const CONFIG_VERSION = 2;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface OwnerFormDraft {
  token: string; // gym slug in this prototype
  gymId: string;
  version: number;
  answers: AnswerMap;
  completedSections: string[]; // section ids the owner advanced past / skipped
  contactName: string;
  contactRole: string;
  lastSaved: string; // ISO timestamp
}

export interface PersistenceLayer {
  load(token: string): OwnerFormDraft | null;
  save(token: string, draft: OwnerFormDraft): void;
  clear(token: string): void;
}

const key = (token: string) => `scout_owner_${token}`;

export const localStoragePersistence: PersistenceLayer = {
  load(token) {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(key(token));
      if (!raw) return null;
      const draft = JSON.parse(raw) as OwnerFormDraft;
      // discard drafts from an old form shape or older than 30 days
      const age = Date.now() - new Date(draft.lastSaved).getTime();
      if (draft.version !== CONFIG_VERSION || !Number.isFinite(age) || age > MAX_AGE_MS) {
        window.localStorage.removeItem(key(token));
        return null;
      }
      return draft;
    } catch {
      return null;
    }
  },
  save(token, draft) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key(token), JSON.stringify(draft));
    } catch {
      // quota / private mode — drafts are best-effort in the prototype
    }
  },
  clear(token) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key(token));
    } catch {
      /* ignore */
    }
  },
};
