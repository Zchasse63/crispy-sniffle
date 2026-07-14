import { GymListSkeleton } from "@/components/ui/Skeleton";

// Discovery is force-dynamic (live Supabase read) — this fallback streams
// instantly so navigation never freezes on the previous screen.
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col">
      {/* hero — mirrors DiscoveryClient's dark search band. `.skeleton`'s
          shimmer is tuned for paper surfaces (near-invisible on ink-deep), so
          this dark band uses animate-pulse on bg-ink-raise instead — same
          reduced-motion guarantee, just a surface-appropriate treatment. */}
      <section className="survey-grid-night bg-ink-deep">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center sm:px-6 sm:py-12">
          <div className="animate-pulse motion-reduce:animate-none">
            <div className="mx-auto h-10 w-72 rounded-md bg-ink-raise sm:h-12 sm:w-96" />
            <div className="mx-auto mt-3 h-4 w-64 rounded-md bg-ink-raise sm:w-80" />
            <div className="mx-auto mt-6 h-14 w-full max-w-2xl rounded-xl border border-ink-line bg-ink-raise" />
            <div className="mx-auto mt-6 h-3 w-56 rounded-md bg-ink-raise" />
          </div>
        </div>
      </section>

      {/* controls row */}
      <div className="border-b border-paper-line bg-paper-raise/95">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:px-6">
          <div className="skeleton h-4 w-20" />
          <div className="ml-auto flex gap-2">
            <div className="skeleton h-8 w-28 rounded-md" />
          </div>
        </div>
      </div>

      {/* main — card grid via the existing (previously-unused) skeleton */}
      <div className="survey-grid mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <GymListSkeleton count={9} />
      </div>
    </div>
  );
}
