/**
 * Parking tip composition — pure, deterministic, no LLM.
 * Used by both server components (ParkingCard) and the MapLibre popup
 * (client) — keep this file free of any server-only imports.
 */
import type {
  GymParkingRecord,
  ParkingAccess,
  ParkingKind,
} from "./types/scout";

/** Walk-time display: ~80 m/min, always approximate ("~" is honesty —
 *  gym coordinates carry real-world uncertainty). */
export function walkMinutes(distance_m: number): string {
  const mins = Math.max(1, Math.round(distance_m / 80));
  return `~${mins} min walk`;
}

/** One-line headline for a parking option. Deterministic template by
 *  kind × access; name and fee_detail interpolate where they clarify. */
export function parkingHeadline(p: GymParkingRecord): string {
  const named = p.name ? ` (${p.name})` : "";
  const fee = p.fee_detail ? ` · ${p.fee_detail}` : "";

  const T: Record<ParkingKind, Record<ParkingAccess, string>> = {
    onsite_lot: {
      free: "Free on-site lot",
      customers: "On-site customer lot",
      validated: `On-site lot, validated${fee}`,
      paid: "On-site lot, paid",
      permit: "On-site lot, permit required",
      unknown: "On-site lot",
    },
    onsite_garage: {
      free: `Free on-site garage${named}`,
      customers: `On-site garage${named} (customers)`,
      validated: `On-site garage${named}${fee}`,
      paid: `On-site garage${named}, paid`,
      permit: `On-site garage${named}, permit required`,
      unknown: `On-site garage${named}`,
    },
    nearby_lot: {
      free: `Free lot nearby${named}`,
      customers: `Customer lot nearby${named}`,
      validated: `Nearby lot${named}${fee}`,
      paid: `Public lot nearby${named}, paid`,
      permit: `Lot nearby${named}, permit only`,
      unknown: `Lot nearby${named}`,
    },
    nearby_garage: {
      free: `Free garage nearby${named}`,
      customers: `Garage nearby${named} (customers)`,
      validated: `Garage nearby${named}${fee}`,
      paid: `Public garage nearby${named}, paid`,
      permit: `Garage nearby${named}, permit only`,
      unknown: `Garage nearby${named}`,
    },
    street: {
      free: `Free street parking${named}`,
      customers: `Street parking${named}`,
      validated: `Street parking${named}`,
      paid: `Metered street parking${named}`,
      permit: `Street parking${named} — permit zones`,
      unknown: `Street parking${named}`,
    },
    valet: {
      free: "Complimentary valet",
      customers: "Valet",
      validated: "Valet",
      paid: "Valet (paid)",
      permit: "Valet",
      unknown: "Valet",
    },
  };

  return T[p.kind][p.access];
}

/** Card summary: primary recommendation + alternatives + attribution flag. */
export function parkingSummary(parking: GymParkingRecord[]): {
  primary: GymParkingRecord;
  headline: string;
  alternatives: GymParkingRecord[];
  hasOsmSource: boolean;
} | null {
  if (parking.length === 0) return null;
  const primary = parking.find((p) => p.is_primary) ?? parking[0];
  return {
    primary,
    headline: parkingHeadline(primary),
    alternatives: parking.filter((p) => p.id !== primary.id),
    hasOsmSource: parking.some((p) => p.source === "osm"),
  };
}
