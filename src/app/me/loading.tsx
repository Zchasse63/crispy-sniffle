// /me is force-dynamic (auth.getUser() + fetchCityGyms) — this fallback
// streams instantly so navigation never freezes on the previous screen.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="skeleton h-3 w-20" />
          <div className="skeleton mt-2 h-8 w-48" />
        </div>
        <div className="skeleton h-9 w-28 rounded-md" />
      </div>

      {/* visit log */}
      <div className="mt-6 rounded-xl border border-paper-line bg-paper-raise p-5">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton mt-3 h-14 w-full rounded-lg" />
      </div>

      {/* saved & followed */}
      <div className="mt-5 rounded-xl border border-paper-line bg-paper-raise p-5">
        <div className="skeleton h-3 w-32" />
        <div className="mt-3 space-y-2">
          <div className="skeleton h-14 w-full rounded-lg" />
          <div className="skeleton h-14 w-full rounded-lg" />
        </div>
      </div>

      {/* training prefs */}
      <div className="mt-5 rounded-xl border border-paper-line bg-paper-raise p-5">
        <div className="skeleton h-3 w-28" />
        <div className="skeleton mt-3 h-16 w-full rounded-lg" />
      </div>
    </div>
  );
}
