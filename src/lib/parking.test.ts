import { describe, it, expect } from "vitest";
import { walkMinutes, parkingHeadline, parkingSummary } from "./parking";
import type { GymParkingRecord } from "./types/scout";

function park(over: Partial<GymParkingRecord> = {}): GymParkingRecord {
  return {
    id: `p-${Math.round(over.distance_m ?? 0)}-${over.kind ?? "x"}`,
    gym_id: "g1",
    kind: "onsite_lot",
    name: null,
    distance_m: 0,
    access: "free",
    fee_detail: null,
    capacity: null,
    lat: null,
    lng: null,
    is_primary: false,
    source: "scraped",
    confidence: 0.85,
    detail: null,
    ...over,
  };
}

describe("walkMinutes", () => {
  it("rounds at ~80 m/min and never goes below 1", () => {
    expect(walkMinutes(0)).toBe("~1 min walk");
    expect(walkMinutes(40)).toBe("~1 min walk");
    expect(walkMinutes(800)).toBe("~10 min walk");
  });
});

describe("parkingHeadline", () => {
  it("renders kind × access templates", () => {
    expect(parkingHeadline(park({ kind: "onsite_lot", access: "free" }))).toBe("Free on-site lot");
    expect(parkingHeadline(park({ kind: "street", access: "paid" }))).toBe("Metered street parking");
  });

  it("interpolates name and fee where they clarify", () => {
    expect(parkingHeadline(park({ kind: "nearby_garage", access: "validated", name: "Poe Garage", fee_detail: "$2/hr" }))).toContain("Poe Garage");
    expect(parkingHeadline(park({ kind: "nearby_garage", access: "validated", name: "Poe Garage", fee_detail: "$2/hr" }))).toContain("$2/hr");
  });
});

describe("parkingSummary", () => {
  it("null for no parking", () => {
    expect(parkingSummary([])).toBeNull();
  });

  it("prefers the is_primary record as primary", () => {
    const a = park({ id: "a", distance_m: 300 });
    const b = park({ id: "b", distance_m: 50, is_primary: true });
    const s = parkingSummary([a, b])!;
    expect(s.primary.id).toBe("b");
    expect(s.alternatives.map((x) => x.id)).toEqual(["a"]);
  });

  it("falls back to first record when none is flagged primary", () => {
    const a = park({ id: "a" });
    const b = park({ id: "b" });
    expect(parkingSummary([a, b])!.primary.id).toBe("a");
  });

  it("flags OSM attribution when any source is osm", () => {
    expect(parkingSummary([park({ source: "osm" })])!.hasOsmSource).toBe(true);
    expect(parkingSummary([park({ source: "scraped" })])!.hasOsmSource).toBe(false);
  });
});
