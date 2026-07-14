"use client";

import { useEffect } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps Tab/Shift-Tab within `containerRef`'s subtree while `active`, and
 * restores focus to whatever element had it when the trap activated once it
 * deactivates (dialog close) — the two pieces every one of Scout's seven
 * overlays was missing.
 *
 * Deliberately narrow: this hook ONLY wraps tabbing + restores focus on
 * close. It does not handle Escape or backdrop-click-close (every overlay
 * already has its own correct handling for those — don't fork it) and it
 * does not grab initial focus itself (some overlays want the close button
 * focused, others a form field or `autoFocus` — the caller decides).
 *
 * OPENER CAPTURE TIMING (the load-bearing contract): this hook snapshots
 * document.activeElement in its own passive effect, so NO overlay may use JSX
 * `autoFocus` — React commits autoFocus during the mutation phase, before any
 * effect runs, which would make the snapshot see the dialog's own autofocused
 * node instead of the real opener (and restore would drop focus to <body>).
 * Instead, every overlay grabs its initial focus via a manual `.focus()` in a
 * useEffect DECLARED AFTER its useFocusTrap call — passive effects run in
 * declaration order, so the trap snapshots the opener first, then the dialog
 * takes focus. (Event-based capture was tried and rejected: programmatic
 * .focus() in a backgrounded document fires no focusin; render-phase ref
 * capture violates react-hooks/refs.)
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    // Snapshot the opener so we can hand focus back on close. See the
    // no-autoFocus contract in the doc comment above.
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
      if (opener && opener !== document.body && document.contains(opener)) {
        opener.focus();
      }
    };
  }, [active, containerRef]);
}
