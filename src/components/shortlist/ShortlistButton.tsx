"use client";

import { Bookmark } from "lucide-react";
import { useShortlistStore } from "@/stores/shortlistStore";
import { useTripStore } from "@/stores/tripStore";
import { useUserStore } from "@/stores/userStore";
import { getBrowserClient } from "@/lib/supabase/browser";
import { toast } from "@/components/ui/Toast";

/** Local-calendar YYYY-MM-DD, matching Trip.startDate/endDate's format and
 *  TrainHereButton's own construction — never toISOString() (UTC-based,
 *  off by a day in the evening for anyone west of UTC). */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Fire-and-forget cloud follow upsert, shared by the save branch AND the
 *  "Removed" toast's Undo — Undo must re-create the cloud row exactly like a
 *  fresh Save would, or a signed-in unsave that actually deleted the row
 *  (alert_email was false) would silently leave the cloud diverged from the
 *  UI (which shows saved again) until the next sign-in merge. */
function syncFollowSaved(userId: string, gymId: string): void {
  void getBrowserClient()
    .from("followed_gyms")
    .upsert(
      { user_id: userId, gym_id: gymId },
      { onConflict: "user_id,gym_id", ignoreDuplicates: true },
    )
    .then(undefined, () => {});
}

export function ShortlistButton({
  gymId,
  citySlug,
  className,
}: {
  gymId: string;
  /** City the gym belongs to — enables the save-to-trip prompt below. Omit
   *  when the caller doesn't have it in scope; the button degrades to its
   *  plain save behavior with no trip check. */
  citySlug?: string | null;
  className?: string;
}) {
  const isSaved = useShortlistStore((s) => s.savedIds.includes(gymId));
  const toggle = useShortlistStore((s) => s.toggle);
  const user = useUserStore((s) => s.user);
  return (
    <button
      type="button"
      aria-label={isSaved ? "Remove from shortlist" : "Save to shortlist"}
      aria-pressed={isSaved}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const wasSaved = isSaved; // pre-toggle state, already subscribed above
        toggle(gymId);

        // Live cloud follow sync for signed-in users — previously a save
        // made while ALREADY signed in never reached `followed_gyms` at all
        // (only the one-time sign-in merge in lib/merge.ts wrote it). Fire
        // -and-forget: nothing in this button's own UI depends on the
        // write's outcome, so there's no local state to roll back on
        // failure (unlike ProfilePortal.toggleFollow, which does). Signed
        // -out users are untouched — localStorage stays the whole story
        // until merge.ts runs at sign-in.
        if (user) {
          const client = getBrowserClient();
          if (wasSaved) {
            // Unsaving here is a casual "remove from shortlist," not "stop
            // caring about this gym" — deliberately asymmetric with
            // ProfilePortal's "Unfollow" button, which deletes
            // unconditionally because THAT click is an explicit stop
            // -everything action. The `alert_email` filter makes this
            // delete a no-op whenever the user separately opted into
            // change alerts (ProfilePortal.toggleAlert sets alert_email
            // true) for this gym, so a quick unbookmark can never silently
            // kill an alerts subscription.
            void client
              .from("followed_gyms")
              .delete()
              .eq("user_id", user.id)
              .eq("gym_id", gymId)
              .eq("alert_email", false)
              .then(undefined, () => {});
          } else {
            syncFollowSaved(user.id, gymId);
          }
        }

        if (wasSaved) {
          toast("Removed", {
            onUndo: () => {
              useShortlistStore.getState().toggle(gymId);
              if (user) syncFollowSaved(user.id, gymId);
            },
          });
          return;
        }
        // count read at event time (getState) — never subscribe this button
        // to the whole list, it renders once per gym card across the grid
        const n = useShortlistStore.getState().savedIds.length;
        const message = n >= 2 ? `Saved · ${n} gyms` : "Saved to shortlist";

        // Save-to-trip prompt wins over the "Compare →" action when both
        // could apply — more specific intent. `trips` is kept sorted
        // ascending by startDate (tripStore/merge.ts), so `.find` naturally
        // lands on the soonest upcoming match; the gymIds check keeps a
        // repeat save/unsave cycle on an already-added gym from re-prompting.
        const trip = citySlug
          ? useTripStore
              .getState()
              .trips.find(
                (t) =>
                  t.citySlug === citySlug &&
                  t.endDate >= todayIso() &&
                  !(t.gymIds ?? []).includes(gymId),
              )
          : undefined;
        if (trip) {
          toast(message, {
            undoLabel: `Add to your ${trip.cityName} trip`,
            onUndo: () => useTripStore.getState().addGymToTrip(trip.id, gymId),
          });
        } else if (n >= 2) {
          toast(message, { actionLabel: "Compare →", actionHref: "/compare" });
        } else {
          toast(message);
        }
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-all ${
        isSaved
          ? "border-blaze bg-blaze text-white"
          : "border-paper-line bg-paper-raise/95 text-ink hover:border-blaze hover:text-blaze"
      } ${className ?? ""}`}
    >
      <Bookmark className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} aria-hidden />
    </button>
  );
}
