// Gym detail is force-dynamic (gym + photos + community + confirmation
// counts, then a second-wave similar-gyms query) — this fallback streams
// instantly so navigation never freezes on the previous screen.
export default function Loading() {
  return (
    <div className="flex-1">
      {/* hero — mirrors the dark band in gym/[slug]/page.tsx. `.skeleton`'s
          shimmer is tuned for paper surfaces (near-invisible on ink-deep), so
          this dark band uses animate-pulse on bg-ink-raise instead — same
          reduced-motion guarantee, just a surface-appropriate treatment. */}
      <section className="survey-grid-night relative overflow-hidden bg-ink-deep">
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="animate-pulse motion-reduce:animate-none">
            <div className="h-3 w-32 rounded-md bg-ink-raise" />
            <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="h-3 w-24 rounded-md bg-ink-raise" />
                <div className="mt-2.5 h-10 w-72 rounded-md bg-ink-raise sm:h-12 sm:w-96" />
                <div className="mt-3 h-3 w-56 rounded-md bg-ink-raise" />
              </div>
              {/* action row — Directions / Call / Website / Instagram / Shortlist / Train here */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="h-9 w-28 rounded-md bg-ink-raise" />
                <div className="h-9 w-20 rounded-md bg-ink-raise" />
                <div className="h-9 w-24 rounded-md bg-ink-raise" />
                <div className="h-9 w-9 rounded-md bg-ink-raise" />
                <div className="h-9 w-9 rounded-md bg-ink-raise" />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <div className="h-8 w-24 rounded-md bg-ink-raise" />
              <div className="h-8 w-28 rounded-md bg-ink-raise" />
              <div className="h-8 w-20 rounded-md bg-ink-raise" />
            </div>
            <div className="mt-6 max-w-2xl space-y-2">
              <div className="h-3 w-full rounded-md bg-ink-raise" />
              <div className="h-3 w-5/6 rounded-md bg-ink-raise" />
            </div>
          </div>
        </div>
      </section>

      {/* body — attribute sections (left) + hours/parking/map (right) */}
      <div className="survey-grid mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            {["Equipment", "Recovery", "Training & Classes", "Facility"].map((label) => (
              <div key={label} className="rounded-xl border border-paper-line bg-paper-raise p-5">
                <div className="skeleton h-3 w-28" />
                <div className="mt-3 space-y-2.5">
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-4 w-5/6" />
                  <div className="skeleton h-4 w-4/6" />
                </div>
              </div>
            ))}
          </div>

          <aside className="space-y-5">
            <div className="rounded-xl border border-paper-line bg-paper-raise p-5">
              <div className="skeleton h-3 w-16" />
              <div className="mt-3 space-y-1.5">
                <div className="skeleton h-3.5 w-full" />
                <div className="skeleton h-3.5 w-full" />
                <div className="skeleton h-3.5 w-2/3" />
              </div>
            </div>
            <div className="rounded-xl border border-paper-line bg-paper-raise p-5">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton mt-3 h-10 w-full rounded-lg" />
            </div>
            <div className="rounded-xl border border-paper-line bg-paper-raise p-5">
              <div className="skeleton h-3 w-16" />
              <div className="skeleton mt-3 h-10 w-full rounded-lg" />
            </div>
            <div className="skeleton h-64 w-full rounded-xl" />
            <div className="rounded-xl border border-paper-line bg-paper-raise p-5">
              <div className="skeleton h-3 w-32" />
              <div className="mt-2.5 space-y-1.5">
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-3 w-4/5" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
