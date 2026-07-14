"use client";

import { useState } from "react";
import type { AttributeItem } from "./AttributeSection";
import { AttributeOverflowModal } from "./AttributeOverflowModal";

/** Thin client boundary that owns the open/closed state for the "Show all
 *  N" disclosure — kept separate so AttributeSection itself stays a server
 *  component; only this trigger + the modal it opens run on the client. */
export function AttributeOverflowTrigger({
  title,
  items,
  gymId,
  factType,
  confirmCounts,
  gymName,
}: {
  title: string;
  items: AttributeItem[];
  gymId?: string;
  factType?: "amenity" | "equipment";
  confirmCounts?: Record<string, number>;
  gymName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="display mt-3 flex w-full items-center justify-center rounded-lg border border-ink/20 bg-paper py-2.5 text-sm tracking-wide text-ink transition-colors hover:border-ink/50"
      >
        Show all {items.length} {title}
      </button>
      {open && (
        <AttributeOverflowModal
          title={title}
          items={items}
          gymId={gymId}
          factType={factType}
          confirmCounts={confirmCounts}
          gymName={gymName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
