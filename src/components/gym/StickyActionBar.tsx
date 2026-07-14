"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

/**
 * Recommended bottom padding for the page while the bar is visible, so the
 * docked bar never covers the last bit of content. Sized for the bar's own
 * row height (~64px) plus a buffer for the safe-area inset the bar already
 * pads itself with — the integrator applies this class conditionally
 * (e.g. only when `useStickyBarVisible().visible` is true).
 */
export const STICKY_ACTION_BAR_PAGE_PADDING_CLASS = "pb-28";

/**
 * Tracks whether the docked mobile action bar should be shown: true once a
 * caller-placed sentinel element has scrolled fully above the viewport (i.e.
 * the user has scrolled past the hero), false otherwise.
 *
 * Usage (in the page that owns the hero + StickyActionBar):
 *   const { sentinelRef, visible } = useStickyBarVisible();
 *   ...
 *   <Hero />
 *   <div ref={sentinelRef} />
 *   ...
 *   {visible && (
 *     <StickyActionBar name={gym.name} priceLine={priceLine}>
 *       {actions}
 *     </StickyActionBar>
 *   )}
 */
export function useStickyBarVisible(): {
  sentinelRef: RefObject<HTMLDivElement | null>;
  visible: boolean;
} {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // "fully above the viewport" — not just "not intersecting", which is
        // also true before the user has ever scrolled down to the sentinel.
        setVisible(!entry.isIntersecting && entry.boundingClientRect.bottom < 0);
      },
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { sentinelRef, visible };
}

/**
 * Docked mobile/tablet action bar (Google Maps-style) — gym name + optional
 * price on the left, primary actions (Directions/Call, etc.) on the right.
 * Desktop (`lg:`) keeps the existing hero action row instead; this never
 * renders there. Mount it only while visible (see `useStickyBarVisible`) —
 * it plays its own slide-up transition on mount.
 */
export function StickyActionBar({
  name,
  priceLine,
  children,
}: {
  name: string;
  priceLine?: string | null;
  children: ReactNode;
}) {
  // Mount with the bar translated off-screen, then flip to its resting
  // position so it slides in — even if the caller conditionally mounts/
  // unmounts it on each visibility change. Double-rAF: a single rAF can run
  // before the browser paints the off-screen frame, which would skip the
  // transition entirely.
  const [entered, setEntered] = useState(false);
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

  return (
    <div
      role="region"
      aria-label={`Quick actions for ${name}`}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-paper-line bg-paper-raise/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out lg:hidden ${
        entered ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="display truncate text-[15px] tracking-wide text-ink">{name}</p>
          {priceLine && (
            <p className="readout mt-0.5 truncate text-[10px] text-ink/65">{priceLine}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      </div>
    </div>
  );
}
