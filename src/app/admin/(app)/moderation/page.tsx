import { getServerClient } from "@/lib/supabase/server";
import { getModerationStats } from "@/lib/admin/moderation";
import { PageHeader, StatTile, Panel, ActionLink } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Moderation · Scout Admin" };

export default async function ModerationPage() {
  const client = await getServerClient();
  const s = await getModerationStats(client);

  return (
    <>
      <PageHeader
        title="Community Moderation"
        description="Reviews and user moderation. Member-suggested fact corrections have their own read-only queue."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Reported"
          value={s.reportedReviews}
          sub="reviews with reports"
          tone={s.reportedReviews > 0 ? "warn" : "good"}
          href="/admin/moderation/reviews?filter=reported"
        />
        <StatTile
          label="Hidden"
          value={s.hiddenReviews}
          sub="currently hidden"
          tone="neutral"
          href="/admin/moderation/reviews?filter=hidden"
        />
        <StatTile label="Total reviews" value={s.totalReviews} sub={`${s.last7Days} in last 7d`} tone="info" href="/admin/moderation/reviews?filter=all" />
        <StatTile
          label="Banned users"
          value={s.bannedUsers}
          sub="cannot post"
          tone={s.bannedUsers > 0 ? "warn" : "neutral"}
          href="/admin/moderation/users"
        />
      </div>

      <Panel className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <ActionLink href="/admin/moderation/reviews?filter=reported" variant="primary">
            Review queue
          </ActionLink>
          <ActionLink href="/admin/moderation/users" variant="ghost">
            Banned users
          </ActionLink>
          <ActionLink href="/admin/moderation/corrections" variant="ghost">
            Corrections queue
          </ActionLink>
        </div>
        <p className="mt-3 text-xs text-mist">
          Hiding or deleting a review immediately recomputes the gym&apos;s rating, so a brigaded review never keeps
          polluting the average. Banning a user hides their existing reviews and blocks new ones.
        </p>
      </Panel>
    </>
  );
}
