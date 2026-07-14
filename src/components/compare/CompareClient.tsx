"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";
import { fetchGymsByIds, fetchGymsBySlugs } from "@/lib/queries/gyms";
import type { EnrichedGym } from "@/lib/types/scout";
import { useShortlistStore } from "@/stores/shortlistStore";
import { CompareTable } from "@/components/compare/CompareTable";
import { ComparePicker } from "@/components/compare/ComparePicker";
import { ShareButton } from "@/components/gym/ShareButton";
import { EmptyState } from "@/components/ui/EmptyState";

/** Parses/caps/dedupes the shareable ?gyms=slug1,slug2,slug3 param. Returns
 *  null when absent — the page falls back to the visitor's own shortlist. */
function parseSharedSlugs(gymsParam: string | null): string[] | null {
  if (!gymsParam) return null;
  const raw = gymsParam.split(",").map((s) => s.trim()).filter(Boolean);
  const slugs = [...new Set(raw)].slice(0, 3);
  return slugs.length > 0 ? slugs : null;
}

export function CompareClient() {
  // useSearchParams needs a Suspense boundary above it (Next's CSR-bailout
  // rule for static pages) — the sibling loading.tsx already provides one:
  // App Router wraps every page.tsx in `<Suspense fallback={<Loading/>}>`
  // automatically when a loading.tsx sibling exists, so no extra wrapper
  // is needed here (would just duplicate that fallback).
  const router = useRouter();
  const searchParams = useSearchParams();
  const savedIds = useShortlistStore((s) => s.savedIds);

  const sharedSlugs = parseSharedSlugs(searchParams.get("gyms"));
  const isSharedMode = sharedSlugs !== null;

  // Own-mode: ALL saved gyms (not just the compared 3) — the picker below
  // needs every name to render its full chip row.
  const [ownGyms, setOwnGyms] = useState<EnrichedGym[] | null>(null);
  // Shared-mode: the visitor's own shortlist is NEVER read or written here —
  // this is a read-only view of someone else's selection.
  const [sharedGyms, setSharedGyms] = useState<EnrichedGym[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => savedIds.slice(0, 3));

  useEffect(() => {
    if (isSharedMode) return;
    if (savedIds.length < 2) {
      // deferred a tick so this doesn't setState synchronously inside the
      // effect body (react-hooks/set-state-in-effect — same defer pattern
      // as TrainHereButton's queueMicrotask)
      queueMicrotask(() => setOwnGyms([]));
      return;
    }
    let cancelled = false;
    fetchGymsByIds(getBrowserClient(), savedIds).then((g) => {
      if (!cancelled) setOwnGyms(g);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSharedMode, savedIds.join(",")]);

  useEffect(() => {
    if (!isSharedMode || !sharedSlugs) return;
    let cancelled = false;
    fetchGymsBySlugs(getBrowserClient(), sharedSlugs).then((g) => {
      if (!cancelled) setSharedGyms(g);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSharedMode, sharedSlugs?.join(",")]);

  // Keep the page-local picker selection in sync with the shortlist (own
  // mode only): drop anything no longer saved, top up from savedIds order
  // when short. Selection itself is page-local state — this never writes
  // BACK to shortlistStore.
  useEffect(() => {
    if (isSharedMode) return;
    // deferred a tick, same reason as the effect above
    queueMicrotask(() => {
      setSelectedIds((prev) => {
        const kept = prev.filter((id) => savedIds.includes(id));
        if (kept.length >= Math.min(2, savedIds.length)) return kept.slice(0, 3);
        const topUp = savedIds.filter((id) => !kept.includes(id));
        return [...kept, ...topUp].slice(0, 3);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSharedMode, savedIds.join(",")]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      // Max 3 selected — adding a 4th evicts the oldest-selected (FIFO).
      if (prev.length >= 3) return [...prev.slice(1), id];
      return [...prev, id];
    });
  }

  const isLoading = isSharedMode ? sharedGyms === null : ownGyms === null;

  // Table columns always render in shortlist (savedIds) order — stable, so
  // toggling chips never reshuffles existing columns.
  const orderedCompareGyms: EnrichedGym[] = isSharedMode
    ? (sharedGyms ?? [])
    : savedIds
        .map((id) => ownGyms?.find((g) => g.id === id))
        .filter((g): g is EnrichedGym => g !== undefined && selectedIds.includes(g.id));

  useEffect(() => {
    document.title =
      orderedCompareGyms.length >= 2
        ? `Compare: ${orderedCompareGyms.map((g) => g.name).join(" vs ")} — Scout`
        : "Compare — Scout";
    // Shared ?gyms= links get real OG cards from the server shell's
    // generateMetadata (app/compare/page.tsx); this client-side title keeps
    // OWN-mode (no URL state) titles current as the selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedCompareGyms.map((g) => g.id).join(",")]);

  const shareUrl =
    orderedCompareGyms.length >= 2
      ? `https://scout-gym.netlify.app/compare?gyms=${orderedCompareGyms.map((g) => encodeURIComponent(g.slug)).join(",")}`
      : undefined;

  const pickerGyms = isSharedMode ? [] : (ownGyms ?? []);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="survey-grid mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6"
    >
      <p className="readout text-pool">Side-by-side</p>
      <h1 className="display mt-1 text-3xl text-ink sm:text-4xl">Compare</h1>

      {isSharedMode ? (
        <p className="mt-2 text-sm text-ink/65">
          Shared comparison — someone else&apos;s picks, not your own shortlist.{" "}
          <Link href="/compare" className="text-pool underline underline-offset-2 hover:text-pool-deep">
            View your own shortlist
          </Link>
        </p>
      ) : (
        <p className="mt-2 text-sm text-ink/65">
          {savedIds.length > 3
            ? `Comparing ${selectedIds.length} of ${savedIds.length} shortlisted gyms, attribute by attribute.`
            : "Your shortlisted gyms, attribute by attribute."}
        </p>
      )}

      {!isSharedMode && pickerGyms.length > 3 && (
        <ComparePicker gyms={pickerGyms} selectedIds={selectedIds} onToggle={toggleSelect} />
      )}

      <div className="mt-6">
        {isLoading ? (
          <div className="skeleton h-96 w-full rounded-xl" />
        ) : orderedCompareGyms.length < 2 ? (
          <EmptyState
            title={isSharedMode ? "This comparison link isn't available" : "Not enough to compare"}
            description={
              isSharedMode
                ? "Some or all of the gyms in this link may have closed or been renamed."
                : "Save at least two gyms from Explore and they'll line up here, attribute by attribute."
            }
            action={{ label: "Find gyms", onClick: () => router.push("/") }}
          />
        ) : (
          <>
            {shareUrl && (
              <div className="mb-3 flex justify-end">
                <ShareButton
                  title={`Compare: ${orderedCompareGyms.map((g) => g.name).join(" vs ")}`}
                  url={shareUrl}
                />
              </div>
            )}
            <CompareTable gyms={orderedCompareGyms} />
          </>
        )}
      </div>
    </main>
  );
}
