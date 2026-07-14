"use client";

import { useEffect } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps Tab/Shift-Tab within `containerRef`'s subtree while `active`, and
 * restores focus to whatever element had it when the trap activated once it
 * deactivates (dialog close) — the two pieces every one of Scout's six
 * overlays was missing.
 *
 * Deliberately narrow: this hook ONLY wraps tabbing + restores focus on
 * close. It does not handle Escape or backdrop-click-close (every overlay
 * already has its own correct handling for those — don't fork it) and it
 * does not grab initial focus itself (some overlays want the close button
 * focused, others a form field or `autoFocus` — the caller decides).
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    // Snapshot the opener so we can hand focus back on close, even if the
    // trapped dialog re-renders (or the opener re-renders) in between.
    const opener = document.activeElement as HTMLElement | null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const node = containerRef.current;
      if (!node) return;
      const focusable = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null, // skip hidden (display:none) elements
      );
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      const withinTrap = current instanceof Node && node.contains(current);

      if (e.shiftKey) {
        if (!withinTrap || current === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!withinTrap || current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Restore focus to the opener — only if it's still attached (it can
      // vanish, e.g. a shortlist row that unmounted while the drawer was open).
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [active, containerRef]);
}
