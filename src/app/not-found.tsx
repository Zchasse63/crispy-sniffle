import Link from "next/link";
import { SignalPin } from "@/components/brand/SignalPin";

export default function NotFound() {
  return (
    <div className="survey-grid flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <span className="text-contour">
        <SignalPin size={84} variant="utility" />
      </span>
      <p className="readout mt-6 text-blaze">404 · Off the map</p>
      <h1 className="display mt-2 text-4xl text-ink">No waypoint here.</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink/65">
        This spot isn&apos;t in Scout&apos;s territory — the gym may have moved,
        closed, or the link is off-trail.
      </p>
      <Link
        href="/"
        className="display mt-7 rounded-lg bg-ink px-5 py-3 text-sm tracking-wider text-paper transition-colors hover:bg-ink-raise"
      >
        Back to Explore
      </Link>
    </div>
  );
}
