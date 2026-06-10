"use client";

import { Bookmark } from "lucide-react";
import { useShortlistStore } from "@/stores/shortlistStore";

export function ShortlistButton({
  gymId,
  className,
}: {
  gymId: string;
  className?: string;
}) {
  const isSaved = useShortlistStore((s) => s.savedIds.includes(gymId));
  const toggle = useShortlistStore((s) => s.toggle);
  return (
    <button
      type="button"
      aria-label={isSaved ? "Remove from shortlist" : "Save to shortlist"}
      aria-pressed={isSaved}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(gymId);
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-all ${
        isSaved
          ? "border-blaze bg-blaze text-white"
          : "border-paper-line bg-paper-raise/95 text-ink hover:border-blaze hover:text-blaze"
      } ${className ?? ""}`}
    >
      <Bookmark className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} aria-hidden />
    </button>
  );
}
