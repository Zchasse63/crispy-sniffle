"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Shared tap-to-toggle popover for compact badges (ProvenanceBadge,
 * DataTierBadge, MatchBadge) whose meaning previously lived ONLY in a
 * `title=` tooltip — invisible to touch and keyboard users. Wraps the
 * badge's existing visual in a real button: click/Enter toggles a small
 * dismissible note; Escape and an outside click both close it;
 * `aria-expanded` + `aria-describedby` wire the note to the trigger for
 * screen readers. `title` stays on the trigger too, so pointer users keep
 * the hover tooltip exactly as before.
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
  const [open, setOpen] = useState(false);
  const noteId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
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
          setOpen((v) => !v);
        }}
        style={triggerStyle}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <span
          id={noteId}
          role="note"
          className={`absolute top-full z-20 mt-1.5 w-56 max-w-[70vw] rounded-md border border-paper-line bg-paper-raise p-2.5 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-ink shadow-[0_18px_44px_-28px_rgba(22,36,46,0.55)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {note}
        </span>
      )}
    </span>
  );
}
