"use client";

/**
 * One-time merge of anonymous local state into the signed-in account:
 * union saved gyms + dedupe trips (cloud wins on conflict), then prefill
 * soft training preferences. Idempotent — safe to re-run.
 */
import { getBrowserClient } from "@/lib/supabase/browser";
import { useShortlistStore } from "@/stores/shortlistStore";
import { useTripStore } from "@/stores/tripStore";
import { useFilterStore } from "@/stores/filterStore";
import { EMPTY_FILTER_SET, type GymSegment, type Trip, type VibeTag } from "@/lib/types/scout";

export async function mergeUserData(userId: string): Promise<void> {
  const client = getBrowserClient();
  try {
    // ── saved gyms: union local + cloud ──
    const localIds = useShortlistStore.getState().savedIds;
    const { data: cloudFollows } = await client
      .from("followed_gyms")
      .select("gym_id")
      .eq("user_id", userId);
    const cloudIds = (cloudFollows ?? []).map((r) => r.gym_id);
    const merged = [...new Set([...cloudIds, ...localIds])];
    const newRows = merged
      .filter((id) => !cloudIds.includes(id))
      .map((gym_id) => ({ user_id: userId, gym_id }));
    if (newRows.length > 0) {
      await client.from("followed_gyms").upsert(newRows, {
        onConflict: "user_id,gym_id",
        ignoreDuplicates: true,
      });
    }
    useShortlistStore.getState().setSavedIds(merged);

    // ── trips: dedupe on (citySlug, startDate, endDate); cloud wins on every
    //    field EXCEPT gym_ids, which unions both sides — gyms saved to a trip
    //    while signed out must survive sign-in even if the cloud already had
    //    a trip at that tuple (e.g. added from another device) ──
    const localTrips = useTripStore.getState().trips;
    const { data: cloudTrips } = await client
      .from("cloud_trips")
      .select("id, city_slug, city_name, start_date, end_date, lodging, gym_ids, created_at")
      .eq("user_id", userId);
    const key = (c: string, s: string, e: string) => `${c}|${s}|${e}`;
    const localByKey = new Map(localTrips.map((t) => [key(t.citySlug, t.startDate, t.endDate), t]));
    const cloudKeys = new Set((cloudTrips ?? []).map((t) => key(t.city_slug, t.start_date, t.end_date)));
    const localOnly = localTrips.filter((t) => !cloudKeys.has(key(t.citySlug, t.startDate, t.endDate)));
    if (localOnly.length > 0) {
      await client.from("cloud_trips").upsert(
        localOnly.map((t) => ({
          user_id: userId,
          city_slug: t.citySlug,
          city_name: t.cityName,
          start_date: t.startDate,
          end_date: t.endDate,
          lodging: t.lodging ?? null,
          gym_ids: t.gymIds ?? [],
        })),
        { onConflict: "user_id,city_slug,start_date,end_date", ignoreDuplicates: true },
      );
    }
    const mergedTrips: Trip[] = [
      ...(cloudTrips ?? []).map((t) => {
        const localMatch = localByKey.get(key(t.city_slug, t.start_date, t.end_date));
        const gymIds = [...new Set([...(t.gym_ids ?? []), ...(localMatch?.gymIds ?? [])])];
        return {
          id: t.id,
          citySlug: t.city_slug,
          cityName: t.city_name,
          startDate: t.start_date,
          endDate: t.end_date,
          createdAt: t.created_at,
          lodging: (t.lodging as Trip["lodging"]) ?? null,
          gymIds,
        };
      }),
      ...localOnly,
    ].sort((a, b) => a.startDate.localeCompare(b.startDate));
    useTripStore.getState().setTrips(mergedTrips);

    // ── training prefs → SOFT filter prefill (Kodawari rule: never hard) ──
    const { data: profile } = await client
      .from("profiles")
      .select("training_prefs")
      .eq("id", userId)
      .maybeSingle();
    const prefs = (profile?.training_prefs ?? {}) as {
      segments?: GymSegment[];
      vibes?: VibeTag[];
    };
    const hasPrefs = (prefs.segments?.length ?? 0) > 0 || (prefs.vibes?.length ?? 0) > 0;
    const filtersUntouched = useFilterStore.getState().filters.rawQuery === "";
    if (hasPrefs && filtersUntouched) {
      useFilterStore.getState().setFilters(
        {
          ...EMPTY_FILTER_SET,
          preferredSegments: prefs.segments ?? [],
          preferredVibes: prefs.vibes ?? [],
        },
        "fallback",
      );
    }
  } catch {
    // merge is best-effort; local state remains authoritative on failure
  }
}
