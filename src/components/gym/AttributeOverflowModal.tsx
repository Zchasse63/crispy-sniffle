"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AttributeRow, dominantSource, type AttributeItem } from "./AttributeSection";
import { useFocusTrap } from "@/lib/useFocusTrap";

/** Full disclosure for a collapsed AttributeSection — the complete item
 *  list, same row rendering (provenance badges + FactConfirm) as the
 *  collapsed view. Portal/backdrop/Escape/focus conventions mirror
 *  SignInModal + Lightbox: portal to <body> (a sticky-header
 *  backdrop-filter clips fixed overlays otherwise — IF-01), backdrop click
 *  and Escape close, body scroll lock, initial focus on the close button. */
export function AttributeOverflowModal({
  title,
  items,
  gymId,
  factType,
  confirmCounts,
  gymName,
  onClose,
}: {
  title: string;
  items: AttributeItem[];
  gymId?: string;
  factType?: "amenity" | "equipment";
  confirmCounts?: Record<string, number>;
  gymName?: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogTitle = gymName ? `All ${title} — ${gymName}` : `All ${title}`;
  const dominant = dominantSource(items);
  useFocusTrap(dialogRef, true);

  useEffect(() => {
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-deep/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={dialogTitle}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-paper-line bg-paper-raise p-6 shadow-[0_24px_60px_-30px_rgba(22,36,46,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="display text-xl text-ink">{dialogTitle}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={`Close all ${title}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-paper-line text-ink/65 transition-colors hover:border-blaze hover:text-blaze"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <ul className="mt-4 flex-1 divide-y divide-paper-line/60 overflow-y-auto">
          {items.map((item) => (
            <AttributeRow
              key={item.key}
              item={item}
              dominant={dominant}
              gymId={gymId}
              factType={factType}
              confirmCounts={confirmCounts}
            />
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
