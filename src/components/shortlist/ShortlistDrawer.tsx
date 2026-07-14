"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bookmark, X } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { fetchGymsByIds } from "@/lib/queries/gyms";
import type { EnrichedGym, ScoredGym } from "@/lib/types/scout";
import { useShortlistStore } from "@/stores/shortlistStore";
import { GymRow } from "@/components/gym/GymRow";
import { toast } from "@/components/ui/Toast";
import { useFocusTrap } from "@/lib/useFocusTrap";

const asScored = (g: EnrichedGym): ScoredGym => ({
  ...g,
  matchScore: null,
  matchReasons: [],
  missingItems: [],
});

export function ShortlistDrawer() {
  const isOpen = useShortlistStore((s) => s.isDrawerOpen);
  const setOpen = useShortlistStore((s) => s.setDrawerOpen);
  const savedIds = useShortlistStore((s) => s.savedIds);
  const remove = useShortlistStore((s) => s.remove);
  const [gyms, setGyms] = useState<EnrichedGym[]>([]);
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(dialogRef, isOpen);
  // Initial focus via effect, NEVER JSX autoFocus — must run AFTER the trap's
  // effect snapshots the opener (declaration order; see useFocusTrap's doc).
  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    if (savedIds.length === 0) {
      // rAF-deferred so no setState runs synchronously inside the effect body
      // (react-hooks/set-state-in-effect — same pattern as GymCard/FilterRail)
      const id = requestAnimationFrame(() => setGyms([]));
      return () => cancelAnimationFrame(id);
    }
    const id = requestAnimationFrame(() => {
      if (cancelled) return;
      // drop locally-removed gyms immediately so the list never shows stale rows
      setGyms((prev) => prev.filter((g) => savedIds.includes(g.id)));
      setLoading(true);
    });
    fetchGymsByIds(getBrowserClient(), savedIds)
      .then((g) => {
        if (!cancelled) setGyms(g);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [isOpen, savedIds]);

  // a11y: Escape closes the drawer
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, setOpen]);

  if (!isOpen) return null;

  const handleRemove = (id: string) => {
    remove(id);
    toast("Removed", { onUndo: () => useShortlistStore.getState().add(id) });
  };

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Shortlist"
    >
      <button
        type="button"
        aria-label="Close shortlist"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
      />
      <div className="absolute bottom-0 right-0 top-0 flex w-full max-w-sm flex-col bg-paper shadow-2xl">
        <div className="flex items-center justify-between border-b border-paper-line bg-paper-raise px-4 py-4">
          <span className="display flex items-center gap-2 text-lg text-ink">
            <Bookmark className="h-4.5 w-4.5 text-blaze" aria-hidden />
            Shortlist
            <span className="font-mono text-xs text-ink/65">({savedIds.length})</span>
          </span>
          <button
            type="button"
            ref={closeRef}
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-paper-line text-ink hover:border-ink/40"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
          {savedIds.length === 0 ? (
            <p className="px-2 py-10 text-center text-sm text-ink/70">
              Nothing saved yet. Tap the bookmark on any gym to start your shortlist.
            </p>
          ) : loading && gyms.length === 0 ? (
            <div className="space-y-2.5">
              {savedIds.map((id) => (
                <div key={id} className="skeleton h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            gyms.map((g) => <GymRow key={g.id} gym={asScored(g)} onRemove={handleRemove} />)
          )}
        </div>

        <div className="border-t border-paper-line bg-paper-raise p-4">
          <Link
            href="/compare"
            onClick={() => setOpen(false)}
            aria-disabled={savedIds.length < 2}
            className={`display block rounded-lg px-4 py-3 text-center text-sm tracking-wider transition-colors ${
              savedIds.length >= 2
                ? "bg-ink text-paper hover:bg-ink-raise"
                : "pointer-events-none bg-paper-line text-ink/40"
            }`}
          >
            Compare side-by-side
          </Link>
          {savedIds.length < 2 && (
            <p className="readout mt-2 text-center text-ink/45">
              Save at least two gyms to compare
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
