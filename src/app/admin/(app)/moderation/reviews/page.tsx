import Link from "next/link";
import { getServerClient } from "@/lib/supabase/server";
import { listReviews, type ReviewFilter } from "@/lib/admin/moderation";
import { PageHeader } from "@/components/admin/ui";
import { ReviewModerationTable } from "@/components/admin/ReviewModerationTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review Queue · Scout Admin" };

const FILTERS: { key: ReviewFilter; label: string }[] = [
  { key: "reported", label: "Reported" },
  { key: "hidden", label: "Hidden" },
  { key: "all", label: "All" },
];

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: rawFilter } = await searchParams;
  const filter: ReviewFilter = rawFilter === "hidden" ? "hidden" : rawFilter === "all" ? "all" : "reported";
  const client = await getServerClient();
  const reviews = await listReviews(client, filter);

  return (
    <>
      <PageHeader title="Review Queue" description="Hide, restore, or delete reviews. Each action recomputes the gym rating." />
      <div className="mb-4 flex items-center gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/moderation/reviews?filter=${f.key}`}
            className={`rounded-md px-3 py-1 text-sm ${
              filter === f.key ? "bg-ink text-paper" : "border border-paper-line text-mist hover:text-ink"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <ReviewModerationTable reviews={reviews} />
    </>
  );
}
