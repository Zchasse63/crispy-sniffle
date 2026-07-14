"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Shared tap-to-toggle popover for compact badges (ProvenanceBadge,
 * DataTierBadge, MatchBadge) whose meaning previously lived ONLY in a
 * `title=` tooltip — invisible to touch and keyboard users. Wraps the
 * badge's existing visual in a real button: click/Enter toggles a small
 * dismissible note; Escape and an outside click both close it;
 * `aria-expanded` + `aria-describedby` wire the note to the trigger for
 * screen readers. `title` stays on the trigger too, so pointer users keep
 * the hover tooltip exactly as before.
 *
 * The note PORTALS to document.body with fixed positioning: several badges
 * live inside `overflow-hidden` ancestors (GymCard's h-40 photo strip is the
 * documented case) that would clip an absolutely-positioned child. The
 * position is computed from the trigger's rect on open and the note simply
 * closes on scroll/resize rather than tracking — these are tap-to-peek
 * notes, not persistent UI.
 */
export function InfoPopover({
  trigger,
  triggerClassName,
  triggerStyle,
  triggerLabel,
  title,
  note,
  align = "left",
}: {
  /** Visual content of the badge (icon + label, etc.) — unchanged from before. */
  trigger: React.ReactNode;
  /** Classes that reproduce the original badge's visual styling. */
  triggerClassName: string;
  triggerStyle?: React.CSSProperties;
  /** Accessible name override — most badges' own visible text already
   *  serves fine as the button's name, so this is only needed when it doesn't. */
  triggerLabel?: string;
  /** Kept on the trigger for pointer-hover users — never removed. */
  title?: string;
  /** Popover body content, shown on tap/click/Enter. */
  note: React.ReactNode;
  /** Which edge the popover hangs from. Most badges sit near the left edge
   *  of their container; a few (top-right corner badges) read better
   *  hanging from the right so they don't run off-screen. */
  align?: "left" | "right";
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const open = pos !== null;
  const noteId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const noteRef = useRef<HTMLSpanElement>(null);

  const NOTE_WIDTH = 224; // w-56 — used to clamp within the viewport

  const openAtTrigger = () => {
    const btn = triggerRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const rawLeft = align === "right" ? r.right - NOTE_WIDTH : r.left;
    const left = Math.min(Math.max(rawLeft, 8), window.innerWidth - NOTE_WIDTH - 8);
    setPos({ top: r.bottom + 6, left });
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || noteRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    // Fixed positioning goes stale the moment the page scrolls or resizes —
    // close instead of tracking (tap-to-peek semantics).
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <span className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        title={title}
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-describedby={open ? noteId : undefined}
        onClick={(e) => {
          // A few of these badges render inside a card-level <Link> (e.g.
          // GymCard/GymRow's MatchBadge) — same nested-interactive
          // mitigation ShortlistButton already uses on those same cards, so
          // tapping the badge toggles the note instead of navigating away.
          e.preventDefault();
          e.stopPropagation();
          if (open) setPos(null);
          else openAtTrigger();
        }}
        style={triggerStyle}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <span
            ref={noteRef}
            id={noteId}
            role="note"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: NOTE_WIDTH }}
            className="z-[60] rounded-md border border-paper-line bg-paper-raise p-2.5 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-ink shadow-[0_18px_44px_-28px_rgba(22,36,46,0.55)]"
          >
            {note}
          </span>,
          document.body,
        )}
    </span>
  );
}
