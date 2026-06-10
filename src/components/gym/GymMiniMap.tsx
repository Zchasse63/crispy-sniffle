"use client";

import { MapView } from "@/components/map/MapView";
import type { EnrichedGym, ScoredGym } from "@/lib/types/scout";

export function GymMiniMap({ gym }: { gym: EnrichedGym }) {
  if (gym.lat === null || gym.lng === null) return null;
  const scored: ScoredGym = { ...gym, matchScore: null, matchReasons: [], missingItems: [] };
  return (
    <div className="h-64 overflow-hidden rounded-xl border border-paper-line">
      <MapView
        gyms={[scored]}
        selectedGymId={null}
        onGymSelect={() => {}}
        center={[gym.lng, gym.lat]}
        zoom={13.6}
      />
    </div>
  );
}
