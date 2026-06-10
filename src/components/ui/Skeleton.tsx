export function GymCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-paper-line bg-paper-raise">
      <div className="skeleton h-40 w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-3 w-1/2" />
        <div className="flex gap-1.5 pt-1">
          <div className="skeleton h-5 w-16" />
          <div className="skeleton h-5 w-14" />
          <div className="skeleton h-5 w-20" />
        </div>
      </div>
    </div>
  );
}

export function GymListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <GymCardSkeleton key={i} />
      ))}
    </div>
  );
}
