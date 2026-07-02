"use client";

import { useMemo, useState } from "react";
import { Expand } from "lucide-react";
import type { GymPhoto } from "@/lib/queries/gyms";
import { Lightbox } from "./Lightbox";

/** Detail-page photo showcase: a prominent hero image plus a thumbnail rail,
 *  every photo click-to-expandable in the Lightbox. Images that fail to load
 *  (dead / hotlink-protected scraped URLs) are dropped so they never render as
 *  blank slots. Renders nothing with no usable photos (the page keeps its
 *  SegmentScene hero fallback). */
export function PhotoGallery({ photos, gymName }: { photos: GymPhoto[]; gymName: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const markFailed = (url: string) => setFailed((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));

  const valid = useMemo(() => photos.filter((p) => !failed.has(p.url)), [photos, failed]);
  if (valid.length === 0) return null;

  const hero = valid[0];
  const rail = valid.slice(1);

  return (
    <section className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
      <button
        type="button"
        onClick={() => setOpen(0)}
        aria-label={`Expand ${gymName} photos`}
        className="group relative block aspect-[16/9] max-h-[26rem] w-full overflow-hidden rounded-xl border border-paper-line bg-paper-raise"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hero.url}
          alt={gymName}
          onError={() => markFailed(hero.url)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
        <span className="font-mono absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-ink-deep/55 px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-white backdrop-blur transition-colors group-hover:bg-ink-deep/75">
          <Expand className="h-3 w-3" aria-hidden />
          {valid.length} photo{valid.length === 1 ? "" : "s"}
        </span>
      </button>

      {rail.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {rail.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpen(idx + 1)}
              aria-label={`Expand photo ${idx + 2} of ${valid.length}`}
              className="group h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-paper-line bg-paper-raise transition-colors hover:border-pool"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt=""
                loading="lazy"
                onError={() => markFailed(p.url)}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </button>
          ))}
        </div>
      )}

      <p className="font-mono mt-2 text-[9.5px] uppercase tracking-wider text-ink/50">
        Photos from the gym&apos;s own site · tap to expand
      </p>

      {open !== null && valid.length > 0 && (
        <Lightbox
          photos={valid}
          index={Math.min(open, valid.length - 1)}
          gymName={gymName}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
