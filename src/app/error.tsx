"use client";

import Link from "next/link";
import { CompassIcon } from "lucide-react";

/** App-level error boundary — Waypoint-toned, recoverable. */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="survey-grid mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <CompassIcon className="h-10 w-10 text-blaze" aria-hidden />
      <h1 className="display mt-4 text-3xl text-ink">Off the map for a second.</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink/75">
        Something broke on our side — your data is fine. Try again, or head
        back to the gym map.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="display rounded-lg bg-blaze-deep px-4 py-2.5 text-sm tracking-wider text-white transition-colors hover:bg-blaze"
        >
          Try again
        </button>
        <Link href="/" className="readout text-pool-deep hover:underline">
          Back to Explore →
        </Link>
      </div>
    </div>
  );
}
