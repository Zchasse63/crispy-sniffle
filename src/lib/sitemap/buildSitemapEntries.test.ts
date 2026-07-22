import { describe, expect, it } from "vitest";
import { buildSitemapEntries } from "./buildSitemapEntries";

const BASE = "https://scout-gym.netlify.app";

describe("buildSitemapEntries", () => {
  it("emits one gym URL per live-city gym and static shells", () => {
    const cities = [
      { id: "c-live", slug: "tampa", is_live: true },
      { id: "c-dark", slug: "orlando", is_live: false },
    ];
    // 1,500 gyms — exercises the pure step that sitemap.ts feeds after paginateAll
    const gyms = Array.from({ length: 1500 }, (_, i) => ({
      slug: `gym-${i}`,
      updated_at: i % 2 === 0 ? "2026-01-01T00:00:00Z" : null,
      city_id: i < 1400 ? "c-live" : "c-dark",
    }));

    const entries = buildSitemapEntries(BASE, gyms, cities);
    const gymUrls = entries.filter((e) => e.url.includes("/gym/"));
    expect(gymUrls).toHaveLength(1400);
    expect(entries.some((e) => e.url === BASE)).toBe(true);
    expect(entries.some((e) => e.url === `${BASE}/city/tampa`)).toBe(true);
    expect(entries.some((e) => e.url === `${BASE}/city/orlando`)).toBe(false);
    expect(entries.some((e) => e.url === `${BASE}/about`)).toBe(true);
    expect(gymUrls[0].url).toBe(`${BASE}/gym/gym-0`);
    expect(gymUrls[0].lastModified).toBeInstanceOf(Date);
  });

  it("drops every gym when no city is live", () => {
    const entries = buildSitemapEntries(
      BASE,
      [{ slug: "x", updated_at: null, city_id: "c1" }],
      [{ id: "c1", slug: "ghost", is_live: false }],
    );
    expect(entries.filter((e) => e.url.includes("/gym/"))).toHaveLength(0);
  });
});
