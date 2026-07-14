"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X } from "lucide-react";
import { create } from "zustand";

// Server always renders nothing (no `document` to portal into); the client's
// FIRST render must match that (or React flags a hydration mismatch), then
// flips true. useSyncExternalStore — not useState+useEffect — is the
// React-documented way to do this without a setState-in-effect footgun.
const noopSubscribe = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export interface ToastActionOpts {
  actionLabel: string;
  actionHref: string;
}
export interface ToastUndoOpts {
  undoLabel?: string;
  onUndo: () => void;
}
export type ToastOpts = ToastActionOpts | ToastUndoOpts;

function isUndoOpts(o: ToastOpts | undefined): o is ToastUndoOpts {
  return !!o && "onUndo" in o;
}

interface ToastItem {
  id: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  undoLabel?: string;
  onUndo?: () => void;
}

interface ToastState {
  toasts: ToastItem[];
  push: (item: ToastItem) => void;
  dismiss: (id: string) => void;
}

const MAX_TOASTS = 2;
const AUTO_DISMISS_MS = 4000;
const EXIT_MS = 200;

/** Ephemeral, unpersisted — a fresh load always starts empty, so unlike
 *  shortlistStore/tripStore there's no hydration mismatch to guard against
 *  and no skipHydration/rehydrate step required. */
const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  // On overflow, drop the OLDEST rather than reject the newest: a toast
  // fires in direct response to the user's most recent action, so silently
  // swallowing the newest one would read as "my click didn't register."
  push: (item) => set((s) => ({ toasts: [...s.toasts, item].slice(-MAX_TOASTS) })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

let seq = 0;

/** Fire a toast. `opts` is either an action link (navigate somewhere) or an
 *  Undo callback — never both. Omit it for a plain confirmation message. */
export function toast(message: string, opts?: ToastOpts): void {
  const id = `toast-${Date.now()}-${seq++}`;
  useToastStore.getState().push(
    isUndoOpts(opts)
      ? { id, message, undoLabel: opts.undoLabel ?? "Undo", onUndo: opts.onUndo }
      : { id, message, actionLabel: opts?.actionLabel, actionHref: opts?.actionHref },
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(AUTO_DISMISS_MS);
  const startRef = useRef(0);
  // Guards the action/undo/dismiss buttons against a double-click firing
  // onUndo (or navigating) twice during the exit transition, when the
  // buttons are still mounted and clickable.
  const actedRef = useRef(false);

  // Double-rAF enter: a single rAF can run before the browser paints the
  // off-screen frame, which would skip the transition entirely (same idiom
  // as StickyActionBar's own mount animation).
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  const requestDismiss = () => {
    // Always clear the pending auto-dismiss timer here (not just at the
    // call sites) — this is also the auto-dismiss timer's own callback, so
    // this covers both "timer fired naturally" and "user acted early"
    // without leaving a stale timerRef that a later pause/resume could
    // reschedule against an already-departing (or already-removed) card.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setLeaving(true);
    setTimeout(() => useToastStore.getState().dismiss(item.id), EXIT_MS);
  };

  const schedule = (ms: number) => {
    startRef.current = Date.now();
    remainingRef.current = ms;
    timerRef.current = setTimeout(requestDismiss, ms);
  };

  useEffect(() => {
    schedule(AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pause = () => {
    if (leaving || !timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    remainingRef.current -= Date.now() - startRef.current;
  };
  const resume = () => {
    if (leaving || timerRef.current) return;
    schedule(Math.max(remainingRef.current, 300));
  };

  return (
    <div
      role="status"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      className={`pointer-events-auto flex w-[calc(100vw-2rem)] max-w-sm items-start gap-3 rounded-lg border border-ink-line bg-ink-raise px-4 py-3 text-paper shadow-[0_18px_44px_-28px_rgba(22,36,46,0.55)] motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out ${
        entered && !leaving ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <p className="min-w-0 flex-1 text-sm leading-snug">{item.message}</p>
      {(item.actionLabel || item.undoLabel) && (
        <>
          <span aria-hidden className="text-paper/40">
            —
          </span>
          {item.actionHref ? (
            <Link
              href={item.actionHref}
              onClick={() => {
                if (actedRef.current) return;
                actedRef.current = true;
                requestDismiss();
              }}
              className="shrink-0 text-sm font-semibold text-paper underline decoration-paper/50 underline-offset-2 hover:decoration-paper"
            >
              {item.actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (actedRef.current) return;
                actedRef.current = true;
                item.onUndo?.();
                requestDismiss();
              }}
              className="shrink-0 text-sm font-semibold text-paper underline decoration-paper/50 underline-offset-2 hover:decoration-paper"
            >
              {item.undoLabel}
            </button>
          )}
        </>
      )}
      <button
        type="button"
        onClick={() => {
          if (actedRef.current) return;
          actedRef.current = true;
          requestDismiss();
        }}
        aria-label="Dismiss"
        className="shrink-0 text-paper/50 transition-colors hover:text-paper"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

/**
 * Mount once, at the root layout, alongside — not inside — HydrationGate:
 * toasts are ephemeral with no persisted state, so unlike AuthGate there is
 * no rehydration race to wait on.
 *
 * Portals to document.body so it always renders above every other
 * fixed-position surface (StickyActionBar z-40, ShortlistDrawer z-50)
 * regardless of where in the tree it's mounted from. `useIsClient()` gates
 * the portal because document.body isn't available during SSR — before
 * that, there's nothing to show anyway.
 */
export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const isClient = useIsClient();
  if (!isClient) return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} />
      ))}
    </div>,
    document.body,
  );
}
