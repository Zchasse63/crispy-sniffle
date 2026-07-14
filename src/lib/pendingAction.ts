/**
 * Pending action across an auth round-trip.
 *
 * A signed-out click on something like "I trained here" has to survive a
 * full page navigation (magic-link email → /auth/callback → back to the
 * gym page). We stash the intent here before opening the sign-in modal, and
 * whoever triggered it reads it back once the user is authenticated.
 */
const KEY = "scout_pending_action";
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export interface PendingAction {
  type: "train_here";
  gymId: string;
  ts: number;
}

export function savePendingAction(gymId: string): void {
  if (typeof window === "undefined") return;
  try {
    const action: PendingAction = { type: "train_here", gymId, ts: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(action));
  } catch {
    // quota / private mode — the action is best-effort, not critical
  }
}

export function readPendingAction(): PendingAction | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const action = JSON.parse(raw) as PendingAction;
    const age = Date.now() - action.ts;
    if (action.type !== "train_here" || !action.gymId || !Number.isFinite(age) || age > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return action;
  } catch {
    return null;
  }
}

export function clearPendingAction(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
