"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";

/** Share/copy-link action for the hero action row. Uses the Web Share API on
 *  devices that support it (native share sheet); everywhere else it copies
 *  the link and shows a 2-second "Link copied" confirmation, announced via
 *  aria-live so screen-reader users hear the state change too. */
export function ShareButton({ title, url }: { title: string; url?: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const onClick = async () => {
    if (typeof window === "undefined") return;
    const shareUrl = url ?? window.location.href;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url: shareUrl });
      } catch (err) {
        // user dismissed the native share sheet — not an error worth surfacing
        if (err instanceof Error && err.name === "AbortError") return;
      }
      return;
    }

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
      } catch {
        return;
      }
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="readout inline-flex items-center gap-1.5 rounded-md border border-ink-line bg-ink-raise px-3 py-2.5 text-paper transition-colors hover:border-mist"
    >
      {copied ? <Check className="h-3 w-3" aria-hidden /> : <Share2 className="h-3 w-3" aria-hidden />}
      <span aria-live="polite">{copied ? "Link copied" : "Share"}</span>
    </button>
  );
}
