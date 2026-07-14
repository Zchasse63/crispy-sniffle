// /compare itself is a client component (gyms fetched client-side once
// shortlist ids are known), but this fallback still smooths the route-segment
// transition while its chunk loads, and matches the sibling routes' treatment.
export default function Loading() {
  return (
    <div className="survey-grid mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton mt-2 h-9 w-40" />
      <div className="mt-2 max-w-md">
        <div className="skeleton h-3 w-full" />
      </div>

      {/* table-ish rows, echoing CompareTable's column/row rhythm */}
      <div className="mt-6 overflow-hidden rounded-xl border border-paper-line bg-paper-raise">
        <div className="flex items-center gap-3 border-b border-paper-line px-3 py-3">
          <div className="skeleton h-4 w-16" />
          <div className="flex flex-1 justify-around gap-3">
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-4 w-20" />
          </div>
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-paper-line/70 px-3 py-2.5 last:border-b-0"
          >
            <div className="skeleton h-3.5 w-20" />
            <div className="flex flex-1 justify-around gap-3">
              <div className="skeleton h-3.5 w-10" />
              <div className="skeleton h-3.5 w-10" />
              <div className="skeleton h-3.5 w-10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
