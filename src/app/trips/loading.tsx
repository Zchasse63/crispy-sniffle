// /trips itself is a client component (no server data fetch — trips live in
// tripStore), but this fallback still smooths the route-segment transition
// while its chunk loads, and matches the sibling routes' treatment.
export default function Loading() {
  return (
    <div className="survey-grid mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="skeleton h-3 w-40" />
          <div className="skeleton mt-2 h-9 w-32" />
          <div className="mt-2 max-w-md space-y-1.5">
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-4/5" />
          </div>
        </div>
        <div className="skeleton h-11 w-32 rounded-lg" />
      </div>

      <div className="mt-7 space-y-5">
        {[2, 1].map((rows, i) => (
          <div key={i} className="rounded-xl border border-paper-line bg-paper-raise p-5">
            <div className="skeleton h-5 w-40" />
            <div className="mt-3 space-y-2">
              {Array.from({ length: rows }, (_, r) => (
                <div key={r} className="skeleton h-16 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
