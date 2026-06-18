"use client";

import { RotateCcw, ArrowRight } from "lucide-react";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (Number.isNaN(then)) return "earlier";
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function ResumeScreen({
  gymName,
  percentComplete,
  nextSectionLabel,
  lastSaved,
  onResume,
  onStartOver,
}: {
  gymName: string;
  percentComplete: number;
  nextSectionLabel: string;
  lastSaved: string;
  onResume: () => void;
  onStartOver: () => void;
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-paper-line bg-paper-raise p-8 text-center">
      <p className="readout text-pool-deep">Welcome back</p>
      <h1 className="display mt-2 text-2xl text-ink">{gymName}</h1>
      <p className="mt-3 text-sm text-ink/65">
        You&apos;re <span className="font-mono font-semibold text-ink">{percentComplete}%</span> done — last saved{" "}
        {relativeTime(lastSaved)}.
      </p>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-paper-line">
        <div className="h-full rounded-full bg-blaze" style={{ width: `${percentComplete}%` }} />
      </div>

      <button
        type="button"
        onClick={onResume}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-ink py-3 text-sm font-medium text-paper transition-colors hover:bg-ink-raise"
      >
        Pick up at {nextSectionLabel}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onStartOver}
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink/50 hover:text-blaze-deep"
      >
        <RotateCcw className="h-3 w-3" aria-hidden /> Start over
      </button>
    </div>
  );
}
