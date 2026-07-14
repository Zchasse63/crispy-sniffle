"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  CalendarCheck2,
  CircleUserRound,
  LogOut,
  Trash2,
} from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { fetchMyVisits, type GymVisit } from "@/lib/queries/community";
import { fetchGymsByIds } from "@/lib/queries/gyms";
import { computeMembershipNudge } from "@/lib/nudge";
import type { EnrichedGym } from "@/lib/types/scout";
import { useShortlistStore } from "@/stores/shortlistStore";
import { useUserStore } from "@/stores/userStore";
import { SignInModal } from "@/components/auth/SignInModal";
import { TrainingPrefs } from "@/components/profile/TrainingPrefs";
import { GymRow } from "@/components/gym/GymRow";

export function ProfilePortal({
  serverUser,
  gyms,
}: {
  serverUser: { id: string; email: string } | null;
  gyms: EnrichedGym[];
}) {
  const router = useRouter();
  const clientUser = useUserStore((s) => s.user);
  const user = clientUser ? { id: clientUser.id, email: clientUser.email ?? "" } : serverUser;
  const [modal, setModal] = useState(false);
  const [visits, setVisits] = useState<GymVisit[] | null>(null);
  const [follows, setFollows] = useState<Map<string, boolean>>(new Map()); // gym_id -> alert_email
  const savedIds = useShortlistStore((s) => s.savedIds);
  const byId = useMemo(() => new Map(gyms.map((g) => [g.id, g])), [gyms]);

  // The server page's `gyms` prop covers visited/followed gyms only — it
  // CANNOT know shortlist saves (localStorage, client-only). Backfill any
  // saved/followed gym missing from the map here, or bookmarked-but-never-
  // visited gyms silently vanish from "Saved & followed" (cross-city too).
  const [extraGyms, setExtraGyms] = useState<EnrichedGym[]>([]);
  const requestedRef = useRef<Set<string>>(new Set());
  const allById = useMemo(() => {
    const m = new Map(byId);
    for (const g of extraGyms) if (!m.has(g.id)) m.set(g.id, g);
    return m;
  }, [byId, extraGyms]);
  useEffect(() => {
    const missing = [...new Set([...savedIds, ...follows.keys()])].filter(
      (id) => !byId.has(id) && !requestedRef.current.has(id),
    );
    if (missing.length === 0) return;
    for (const id of missing) requestedRef.current.add(id);
    let cancelled = false;
    fetchGymsByIds(getBrowserClient(), missing)
      .then((gs) => {
        if (!cancelled && gs.length > 0) {
          setExtraGyms((prev) => [...prev, ...gs.filter((g) => !prev.some((p) => p.id === g.id))]);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedIds.join(","), follows, byId]);

  useEffect(() => {
    if (!user) return;
    const client = getBrowserClient();
    fetchMyVisits(client, user.id).then(setVisits).catch(() => setVisits([]));
    client
      .from("followed_gyms")
      .select("gym_id, alert_email")
      .eq("user_id", user.id)
      .then(({ data }) => setFollows(new Map((data ?? []).map((r) => [r.gym_id, r.alert_email]))));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-xl flex-1 px-4 py-16 text-center sm:px-6"
      >
        <CircleUserRound className="mx-auto h-10 w-10 text-pool" aria-hidden />
        <h1 className="display mt-3 text-3xl text-ink">Your Scout</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink/75">
          Log visits, sync saved gyms across devices, follow gyms for change
          alerts, and get honest math on when a membership beats day passes.
          Password or one-tap email link — your call.
        </p>
        <button
          type="button"
          onClick={() => setModal(true)}
          className="display mt-5 rounded-lg bg-blaze-deep px-5 py-3 text-sm tracking-wider text-white transition-colors hover:bg-blaze"
        >
          Sign in
        </button>
        {modal && <SignInModal onClose={() => setModal(false)} />}
      </main>
    );
  }

  const nudges = (visits ?? [])
    .map((v) => allById.get(v.gym_id))
    .filter((g, i, arr): g is EnrichedGym => Boolean(g) && arr.indexOf(g) === i)
    .map((g) => computeMembershipNudge(visits ?? [], g))
    .filter((n): n is NonNullable<typeof n> => n !== null);

  // optimistic toggles roll back on a failed write so the UI never shows a
  // state the database didn't accept (silent divergence was the prior risk)
  const toggleFollow = async (gymId: string) => {
    const client = getBrowserClient();
    const prev = follows;
    if (follows.has(gymId)) {
      const next = new Map(follows);
      next.delete(gymId);
      setFollows(next);
      const { error } = await client.from("followed_gyms").delete().eq("user_id", user.id).eq("gym_id", gymId);
      if (error) setFollows(prev);
    } else {
      setFollows(new Map(follows).set(gymId, false));
      const { error } = await client.from("followed_gyms").upsert(
        { user_id: user.id, gym_id: gymId },
        { onConflict: "user_id,gym_id", ignoreDuplicates: true },
      );
      if (error) setFollows(prev);
    }
  };

  const toggleAlert = async (gymId: string) => {
    const cur = follows.get(gymId) ?? false;
    const prev = follows;
    setFollows(new Map(follows).set(gymId, !cur));
    const { error } = await getBrowserClient()
      .from("followed_gyms")
      .update({ alert_email: !cur })
      .eq("user_id", user.id)
      .eq("gym_id", gymId);
    if (error) setFollows(prev);
  };

  const removeVisit = async (id: string) => {
    const removed = (visits ?? []).find((x) => x.id === id);
    setVisits((v) => (v ?? []).filter((x) => x.id !== id));
    const { error } = await getBrowserClient().from("gym_visits").delete().eq("id", id);
    if (error && removed) {
      // functional re-insert (not a stale snapshot) so a concurrent removal of
      // a different row isn't clobbered; restore newest-first order
      setVisits((v) =>
        (v ?? []).some((x) => x.id === id)
          ? (v ?? [])
          : [...(v ?? []), removed].sort((a, b) => b.visited_on.localeCompare(a.visited_on)),
      );
    }
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="readout text-pool">Your Scout</p>
          <h1 className="display mt-1 text-3xl text-ink">{user.email}</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            // router.refresh() re-runs the server component so the stale
            // signed-in serverUser (this page's fallback while clientUser
            // catches up) clears along with the client-side auth state —
            // otherwise ProfilePortal keeps rendering the old profile.
            void getBrowserClient()
              .auth.signOut()
              .then(() => router.refresh());
          }}
          className="readout flex items-center gap-1.5 rounded-md border border-paper-line px-3 py-2 text-ink/70 transition-colors hover:border-blaze hover:text-blaze"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden /> Sign out
        </button>
      </div>

      {/* membership nudges — the honest math */}
      {nudges.map((n) => (
        <div
          key={n.gymId}
          className="mt-5 rounded-xl border border-pool/40 bg-pool-tint/60 p-4"
        >
          <p className="text-sm leading-relaxed text-ink">
            <b>{n.message}</b>{" "}
            {allById.get(n.gymId)?.slug && (
              <Link
                href={`/gym/${allById.get(n.gymId)!.slug}`}
                className="font-semibold text-pool-deep underline decoration-pool/40 underline-offset-2"
              >
                See membership options →
              </Link>
            )}
          </p>
        </div>
      ))}

      {/* visit log */}
      <section className="mt-6 rounded-xl border border-paper-line bg-paper-raise p-5">
        <h2 className="readout flex items-center gap-1.5 text-ink/65">
          <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden /> Visit log
        </h2>
        {visits === null ? (
          <div className="skeleton mt-3 h-14 w-full rounded-lg" />
        ) : visits.length === 0 ? (
          <p className="mt-3 text-sm text-ink/70">
            No visits yet — tap <b>“I trained here”</b> on any gym page after a session.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-paper-line/60">
            {visits.map((v) => {
              const gym = allById.get(v.gym_id);
              return (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0 text-sm text-ink/85">
                    {gym ? (
                      <Link href={`/gym/${gym.slug}`} className="font-semibold hover:underline">
                        {gym.name}
                      </Link>
                    ) : (
                      "A gym"
                    )}
                    <span className="font-mono ml-2 text-[10px] uppercase tracking-wide text-ink/55">
                      {new Date(`${v.visited_on}T12:00:00`).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void removeVisit(v.id)}
                    aria-label="Remove visit"
                    className="text-ink/45 transition-colors hover:text-blaze"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* saved gyms + follows/alerts */}
      <section className="mt-5 rounded-xl border border-paper-line bg-paper-raise p-5">
        <h2 className="readout flex items-center gap-1.5 text-ink/65">
          <BellRing className="h-3.5 w-3.5" aria-hidden /> Saved & followed
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-ink/65">
          Follow a gym to get an email when its hours, prices, or equipment
          change (alerts launch soon — opting in reserves yours).
        </p>
        {savedIds.length === 0 && follows.size === 0 ? (
          <p className="mt-3 text-sm text-ink/70">
            Nothing saved yet — tap the bookmark on any gym card.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {[...new Set([...savedIds, ...follows.keys()])].map((id) => {
              const gym = allById.get(id);
              if (!gym) return null;
              const followed = follows.has(id);
              const alerts = follows.get(id) ?? false;
              return (
                <li key={id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <GymRow gym={{ ...gym, matchScore: null, matchReasons: [], missingItems: [] }} />
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => void toggleFollow(id)}
                      className={`font-mono rounded-md border px-2 py-1 text-[10px] uppercase tracking-wide transition-colors ${
                        followed
                          ? "border-pool-deep bg-pool-tint text-ink"
                          : "border-paper-line text-ink/70 hover:border-ink/40"
                      }`}
                    >
                      {followed ? "Following" : "Follow"}
                    </button>
                    {followed && (
                      <button
                        type="button"
                        onClick={() => void toggleAlert(id)}
                        className={`font-mono rounded-md border px-2 py-1 text-[10px] uppercase tracking-wide transition-colors ${
                          alerts
                            ? "border-blaze-deep bg-blaze/10 text-ink"
                            : "border-paper-line text-ink/70 hover:border-ink/40"
                        }`}
                      >
                        {alerts ? "Alerts on" : "Alerts off"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <TrainingPrefs userId={user.id} />

      <p className="mt-6 text-center">
        <Link href="/trips" className="readout text-pool-deep hover:underline">
          Manage trips →
        </Link>
      </p>
    </main>
  );
}
