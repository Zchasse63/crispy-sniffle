"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CalendarCheck2,
  CircleUserRound,
  Loader2,
  LogOut,
  Trash2,
} from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { fetchMyVisits, type GymVisit } from "@/lib/queries/community";
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
  const clientUser = useUserStore((s) => s.user);
  const user = clientUser ? { id: clientUser.id, email: clientUser.email ?? "" } : serverUser;
  const [modal, setModal] = useState(false);
  const [visits, setVisits] = useState<GymVisit[] | null>(null);
  const [follows, setFollows] = useState<Map<string, boolean>>(new Map()); // gym_id -> alert_email
  const savedIds = useShortlistStore((s) => s.savedIds);
  const byId = useMemo(() => new Map(gyms.map((g) => [g.id, g])), [gyms]);

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
      <div className="mx-auto w-full max-w-xl flex-1 px-4 py-16 text-center sm:px-6">
        <CircleUserRound className="mx-auto h-10 w-10 text-pool" aria-hidden />
        <h1 className="display mt-3 text-3xl text-ink">Your Scout</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink/75">
          Log visits, sync saved gyms across devices, follow gyms for change
          alerts, and get honest math on when a membership beats day passes.
        </p>
        <button
          type="button"
          onClick={() => setModal(true)}
          className="display mt-5 rounded-lg bg-blaze-deep px-5 py-3 text-sm tracking-wider text-white transition-colors hover:bg-blaze"
        >
          Sign in with email
        </button>
        {modal && <SignInModal onClose={() => setModal(false)} />}
      </div>
    );
  }

  const nudges = (visits ?? [])
    .map((v) => byId.get(v.gym_id))
    .filter((g, i, arr): g is EnrichedGym => Boolean(g) && arr.indexOf(g) === i)
    .map((g) => computeMembershipNudge(visits ?? [], g))
    .filter((n): n is NonNullable<typeof n> => n !== null);

  const toggleFollow = async (gymId: string) => {
    const client = getBrowserClient();
    if (follows.has(gymId)) {
      const next = new Map(follows);
      next.delete(gymId);
      setFollows(next);
      await client.from("followed_gyms").delete().eq("user_id", user.id).eq("gym_id", gymId);
    } else {
      setFollows(new Map(follows).set(gymId, false));
      await client.from("followed_gyms").upsert(
        { user_id: user.id, gym_id: gymId },
        { onConflict: "user_id,gym_id", ignoreDuplicates: true },
      );
    }
  };

  const toggleAlert = async (gymId: string) => {
    const cur = follows.get(gymId) ?? false;
    setFollows(new Map(follows).set(gymId, !cur));
    await getBrowserClient()
      .from("followed_gyms")
      .update({ alert_email: !cur })
      .eq("user_id", user.id)
      .eq("gym_id", gymId);
  };

  const removeVisit = async (id: string) => {
    setVisits((v) => (v ?? []).filter((x) => x.id !== id));
    await getBrowserClient().from("gym_visits").delete().eq("id", id);
  };

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="readout text-pool">Your Scout</p>
          <h1 className="display mt-1 text-3xl text-ink">{user.email}</h1>
        </div>
        <button
          type="button"
          onClick={() => void getBrowserClient().auth.signOut()}
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
            {byId.get(n.gymId)?.slug && (
              <Link
                href={`/gym/${byId.get(n.gymId)!.slug}`}
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
              const gym = byId.get(v.gym_id);
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
              const gym = byId.get(id);
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
    </div>
  );
}
