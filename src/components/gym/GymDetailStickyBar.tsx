"use client";

import { Navigation } from "lucide-react";
import { ShortlistButton } from "@/components/shortlist/ShortlistButton";
import { StickyActionBar, useStickyBarVisible } from "./StickyActionBar";

/**
 * Mounts the docked mobile action bar on the gym detail page. `page.tsx` is a
 * Server Component, so the sentinel + `StickyActionBar` (both client-only —
 * `useStickyBarVisible` needs `IntersectionObserver`) live behind this one
 * "use client" boundary. Mount once, with the sentinel placed right after the
 * hero section, per `StickyActionBar`'s own integration notes.
 *
 * `directionsHref` is nullable — a gym with no coordinates and no address has
 * no maps link to offer, and we never fabricate one (never-fabricate rule).
 */
export function GymDetailStickyBar({
  name,
  priceLine,
  directionsHref,
  gymId,
  citySlug,
}: {
  name: string;
  priceLine?: string | null;
  directionsHref: string | null;
  gymId: string;
  /** Threaded to ShortlistButton for the save-to-trip prompt. */
  citySlug?: string | null;
}) {
  const { sentinelRef, visible } = useStickyBarVisible();

  return (
    <>
      <div ref={sentinelRef} />
      {visible && (
        <StickyActionBar name={name} priceLine={priceLine}>
          {directionsHref && (
            <a
              href={directionsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="readout inline-flex items-center gap-1.5 rounded-md bg-blaze-deep px-3 py-2.5 text-white transition-colors hover:bg-blaze"
            >
              <Navigation className="h-3 w-3" aria-hidden /> Directions
            </a>
          )}
          <ShortlistButton gymId={gymId} citySlug={citySlug} />
        </StickyActionBar>
      )}
    </>
  );
}
