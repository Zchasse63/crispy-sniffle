"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { GymPhoto } from "@/lib/queries/gyms";
import { useFocusTrap } from "@/lib/useFocusTrap";

/** Full-screen photo viewer. Keyboard (Esc / ← / →), swipe, backdrop-close,
 *  body-scroll lock — mirrors the SignInModal portal pattern. */
export function Lightbox({
  photos,
  index,
  gymName,
  onClose,
}: {
  photos: GymPhoto[];
  index: number;
  gymName: string;
  onClose: () => void;
}) {
  const [i, setI] = useState(index);
  const touchX = useRef<number | null>(null);
  const n = photos.length;
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(dialogRef, true);

  const go = useCallback((delta: number) => setI((v) => (v + delta + n) % n), [n]);

  useEffect(() => {
    // Unlike Scout's other five overlays, the Lightbox never gave itself
    // initial focus — Tab from the trigger photo landed straight back in
    // the page behind it. Focus the close button, same convention as
    // AttributeOverflowModal.
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, go]);

  // The photo list can shrink while open (a rail <img> onErrors away), so clamp
  // the index — otherwise photos[i] is undefined and cur.url throws.
  if (n === 0) return null;
  const idx = i < n ? i : n - 1;
  const cur = photos[idx];
  const caption = cur.subject ? cur.subject.replace(/_/g, " ") : null;

  return createPortal(
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[60] flex flex-col bg-ink-deep/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`${gymName} photos`}
      onClick={onClose}
    >
      {/* top bar: survey-style zero-padded counter + close */}
      <div className="flex items-center justify-between px-5 py-4">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-mist">
          {String(idx + 1).padStart(2, "0")} <span className="text-mist/45">/ {String(n).padStart(2, "0")}</span>
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close photos"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-line bg-ink-raise text-mist transition-colors hover:border-mist hover:text-paper"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* stage */}
      <div
        className="relative flex flex-1 items-center justify-center px-4 pb-6 sm:px-14"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
          if (Math.abs(dx) > 40 && n > 1) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        {n > 1 && (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous photo"
            className="absolute left-2 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-ink-line bg-ink-raise/80 text-mist backdrop-blur transition-colors hover:border-mist hover:text-paper sm:left-4"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cur.url}
          alt={`${gymName}${caption ? ` — ${caption}` : ""}`}
          className="max-h-full max-w-full rounded-lg border border-ink-line object-contain shadow-2xl"
        />

        {n > 1 && (
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next photo"
            className="absolute right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-ink-line bg-ink-raise/80 text-mist backdrop-blur transition-colors hover:border-mist hover:text-paper sm:right-4"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        )}

        {caption && (
          <span className="font-mono absolute bottom-1 left-1/2 -translate-x-1/2 rounded-md border border-ink-line bg-ink-raise/80 px-2.5 py-1 text-[10px] uppercase tracking-wider text-mist backdrop-blur">
            {caption}
          </span>
        )}
      </div>
    </div>,
    document.body,
  );
}
