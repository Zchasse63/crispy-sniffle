/**
 * Scale regression pack (audit P1#9 / Kimi): mock PostgREST client, no network.
 * Covers chunkedIn chunking + 1000-row warn, and fetchCityGyms paging through
 * >1000 gym rows with empty child joins.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHUNK_ROW_CAP,
  IN_CHUNK,
  chunkedIn,
  fetchCityGyms,
} from "./gyms";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type Client = SupabaseClient<Database>;

// ── Fluent PostgREST-ish mock ──────────────────────────────────────────

type Filter =
  | { kind: "eq"; col: string; val: unknown }
  | { kind: "in"; col: string; vals: unknown[] }
  | { kind: "not_in"; col: string; vals: string[] };

type TableData = Record<string, unknown[]>;

function makeMockClient(tables: TableData) {
  const rangeCalls: Array<{ table: string; from: number; to: number }> = [];
  const inCalls: Array<{ table: string; col: string; ids: unknown[] }> = [];

  function applyFilters(rows: unknown[], filters: Filter[]): unknown[] {
    let out = rows;
    for (const f of filters) {
      if (f.kind === "eq") {
        out = out.filter((r) => (r as Record<string, unknown>)[f.col] === f.val);
      } else if (f.kind === "in") {
        const set = new Set(f.vals);
        out = out.filter((r) => set.has((r as Record<string, unknown>)[f.col]));
      } else if (f.kind === "not_in") {
        const set = new Set(f.vals);
        out = out.filter(
          (r) => !set.has(String((r as Record<string, unknown>)[f.col] ?? "")),
        );
      }
    }
    return out;
  }

  function builder(table: string) {
    const filters: Filter[] = [];
    let range: [number, number] | null = null;
    let single = false;

    const api = {
      select(_cols?: string) {
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push({ kind: "eq", col, val });
        return api;
      },
      in(col: string, vals: unknown[]) {
        filters.push({ kind: "in", col, vals });
        inCalls.push({ table, col, ids: vals });
        return api;
      },
      not(col: string, op: string, raw: string) {
        // `.not("status", "in", "(closed,moved,duplicate)")`
        if (op === "in") {
          const vals = raw.replace(/^\(|\)$/g, "").split(",").map((s) => s.trim());
          filters.push({ kind: "not_in", col, vals });
        }
        return api;
      },
      order(_col: string, _opts?: unknown) {
        return api;
      },
      range(from: number, to: number) {
        range = [from, to];
        rangeCalls.push({ table, from, to });
        return api;
      },
      maybeSingle() {
        single = true;
        return api;
      },
      then(resolve: (v: { data: unknown; error: null }) => unknown, reject?: (e: unknown) => unknown) {
        try {
          let rows = applyFilters(tables[table] ?? [], filters);
          if (range) {
            const [from, to] = range;
            rows = rows.slice(from, to + 1);
          }
          if (single) {
            resolve({ data: rows[0] ?? null, error: null });
          } else {
            resolve({ data: rows, error: null });
          }
        } catch (e) {
          if (reject) reject(e);
          else throw e;
        }
      },
    };
    return api;
  }

  const client = {
    from(table: string) {
      return builder(table);
    },
  } as unknown as Client;

  return { client, rangeCalls, inCalls };
}

function stubGymRow(i: number, cityId: string) {
  return {
    id: `gym-${i}`,
    slug: `gym-${i}`,
    city_id: cityId,
    name: `Gym ${i}`,
    neighborhood: null,
    address: null,
    lat: 27.9,
    lng: -82.4,
    description: null,
    segment: "big_box",
    day_pass_price: null,
    week_pass_price: null,
    hours: null,
    website: null,
    phone: null,
    instagram: null,
    photo_url: null,
    photo_storage_path: null,
    rating: null,
    rating_count: 0,
    verified: false,
    owner_listed: false,
    hours_verified_at: null,
    day_pass_verified_at: null,
    data_source: null,
    status: "open",
    rating_is_seed: false,
    vibe_tags: [],
    drop_in_policy: null,
    drop_in_note: null,
    monthly_from: null,
    monthly_note: null,
    enrollment_fee: null,
    annual_fee: null,
    annual_fee_label: null,
    single_class_price: null,
    class_packs: null,
    intro_offer: null,
    min_commitment_months: null,
    no_contract_option: null,
    early_termination: null,
    cancellation_notice_days: null,
    freeze_policy: null,
    membership_plans: null,
    student_discount: null,
    military_discount: null,
    senior_discount: null,
    corporate_discount: null,
    family_plans: null,
    guest_policy_model: null,
    app_required_entry: null,
    waitlist: null,
    members_guest_note: null,
    pricing_notes: null,
    cities: { timezone: "America/New_York" },
  };
}

// ── chunkedIn ──────────────────────────────────────────────────────────

describe("chunkedIn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("chunks 500 ids into 50-id windows and concatenates all rows", async () => {
    const ids = Array.from({ length: 500 }, (_, i) => `id-${i}`);
    const seenChunks: string[][] = [];
    const rows = await chunkedIn<{ gym_id: string; n: number }>(ids, (chunk) => {
      seenChunks.push(chunk);
      return Promise.resolve({
        data: chunk.map((id, i) => ({ gym_id: id, n: i })),
        error: null,
      });
    });
    expect(seenChunks).toHaveLength(500 / IN_CHUNK); // 10
    expect(seenChunks.every((c) => c.length === IN_CHUNK)).toBe(true);
    expect(seenChunks[0][0]).toBe("id-0");
    expect(seenChunks[9][49]).toBe("id-499");
    expect(rows).toHaveLength(500);
  });

  it("console.warns when a chunk response is exactly CHUNK_ROW_CAP rows", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ids = Array.from({ length: 50 }, (_, i) => `id-${i}`);
    await chunkedIn(ids, () =>
      Promise.resolve({
        data: Array.from({ length: CHUNK_ROW_CAP }, (_, i) => ({ i })),
        error: null,
      }),
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(
      new RegExp(`chunkedIn.*${CHUNK_ROW_CAP}`),
    );
  });

  it("propagates a chunk error", async () => {
    await expect(
      chunkedIn(["a"], () =>
        Promise.resolve({ data: null, error: { message: "boom" } }),
      ),
    ).rejects.toEqual({ message: "boom" });
  });
});

// ── fetchCityGyms ──────────────────────────────────────────────────────

describe("fetchCityGyms (mock PostgREST)", () => {
  it("returns all 1,200 enriched gyms across paginated loads + empty joins", async () => {
    const cityId = "city-tampa";
    const gyms = Array.from({ length: 1200 }, (_, i) => stubGymRow(i, cityId));
    const { client, rangeCalls, inCalls } = makeMockClient({
      cities: [
        {
          id: cityId,
          slug: "tampa",
          name: "Tampa",
          state: "FL",
          tier: "rich",
          is_live: true,
          lat: 27.95,
          lng: -82.45,
          timezone: "America/New_York",
        },
      ],
      gyms,
      gym_amenities: [],
      gym_equipment: [],
      gym_parking: [],
      gym_transit: [],
    });

    const { city, gyms: enriched } = await fetchCityGyms(client, "tampa");
    expect(city?.slug).toBe("tampa");
    expect(enriched).toHaveLength(1200);
    expect(enriched[0].id).toBe("gym-0");
    expect(enriched[1199].id).toBe("gym-1199");
    expect(enriched[0].amenities).toEqual([]);
    expect(enriched[0].equipment).toEqual([]);

    // loadCityGymRows pages: range(0,999) + range(1000,1999)
    const gymRanges = rangeCalls.filter((r) => r.table === "gyms");
    expect(gymRanges).toEqual([
      { table: "gyms", from: 0, to: 999 },
      { table: "gyms", from: 1000, to: 1999 },
    ]);

    // joinGyms chunkedIn: 1200 ids / 50 = 24 chunks × 4 child tables
    const amenityIns = inCalls.filter((c) => c.table === "gym_amenities");
    expect(amenityIns).toHaveLength(1200 / IN_CHUNK);
    expect(amenityIns.every((c) => c.ids.length <= IN_CHUNK)).toBe(true);
  });
});
