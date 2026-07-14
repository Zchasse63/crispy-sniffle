"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { fetchCities } from "@/lib/queries/gyms";
import { useFilterStore } from "@/stores/filterStore";
import type { City } from "@/lib/types/scout";

const COOKIE_NAME = "scout-city";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Compact city dropdown mounted in DiscoveryClient's controls row (next to
 * sort) — NOT the header, which stays city-agnostic (see SiteHeader's
 * neutral "Beta" badge). Self-contained: fetches the live-city list itself
 * so it works identically whether it's rendered from "/" or "/city/[slug]".
 */
export function CitySwitcher({ currentCity }: { currentCity: City }) {
  const router = useRouter();
  const [liveCities, setLiveCities] = useState<City[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCities(getBrowserClient())
      .then((cities) => {
        if (!cancelled) setLiveCities(cities.filter((c) => c.is_live));
      })
      .catch(() => {
        if (!cancelled) setLiveCities([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing to switch between yet (Tampa-only beta) — stay invisible rather
  // than show a single-option dropdown. Activates automatically once a
  // second city flips is_live, no further code changes needed.
  if (!liveCities || liveCities.length < 2) return null;

  const onChange = (slug: string) => {
    if (slug === currentCity.slug) return;
    // Filters/travel/sort are city-scoped in practice: a Tampa neighborhood
    // hard-filter (or a Near-Me polygon anchored near Tampa) carried into
    // Miami excludes every gym with no visible way to recover — the
    // neighborhood rail is hidden for basic-tier cities. Reset the lot.
    useFilterStore.getState().resetFilters();
    document.cookie = `${COOKIE_NAME}=${slug}; path=/; max-age=${COOKIE_MAX_AGE}`;
    router.push(`/?city=${slug}`);
  };

  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor="city-switcher" className="sr-only">
        Switch city
      </label>
      <MapPin className="hidden h-3.5 w-3.5 shrink-0 text-ink/50 sm:block" aria-hidden />
      <select
        id="city-switcher"
        value={currentCity.slug}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Switch city"
        className="font-mono rounded-md border border-paper-line bg-paper-raise px-2 py-2 text-[11px] uppercase tracking-wide text-ink/80 hover:border-ink/40 focus:border-ink/40 focus:outline-none"
      >
        {liveCities.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
