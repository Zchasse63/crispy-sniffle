import { describe, it, expect } from "vitest";
import { parseQueryLocally, phraseMatches } from "./nlParser";

const CITY = "tampa";

describe("phraseMatches — word-boundary semantics", () => {
  it("matches whole words and multi-word phrases", () => {
    expect(phraseMatches(" need a squat rack nearby ", "squat rack")).toBe(true);
    expect(phraseMatches(" power racks available ", "power racks")).toBe(true);
    expect(phraseMatches(" rower and bikes ", "rower")).toBe(true);
  });

  it("does not match mid-word substrings", () => {
    expect(phraseMatches(" running track nearby ", "rack")).toBe(false);
    expect(phraseMatches(" good energy vibe ", "erg")).toBe(false);
    expect(phraseMatches(" spine corrector class ", "spin")).toBe(false);
  });
});

describe("parseQueryLocally — collision corpus (must NOT false-match)", () => {
  it('"running track" does not hit squat_rack', () => {
    const f = parseQueryLocally("running track", CITY);
    expect(f.equipment.keys).not.toContain("squat_rack");
  });

  it('"good energy" does not hit rower', () => {
    const f = parseQueryLocally("good energy", CITY);
    expect(f.equipment.keys).not.toContain("rower");
  });

  it('"box jumps" does not hit crossfit segment', () => {
    const f = parseQueryLocally("box jumps", CITY);
    expect(f.preferredSegments).not.toContain("crossfit");
  });

  it('"spine corrector" does not hit cycling segment', () => {
    const f = parseQueryLocally("spine corrector", CITY);
    expect(f.preferredSegments).not.toContain("cycling");
  });

  it('"pilates barrel" does not hit barre segment', () => {
    const f = parseQueryLocally("pilates barrel", CITY);
    expect(f.preferredSegments).not.toContain("barre");
  });
});

describe("parseQueryLocally — positive matches still fire", () => {
  it('"squat rack" → squat_rack', () => {
    const f = parseQueryLocally("squat rack", CITY);
    expect(f.equipment.keys).toContain("squat_rack");
  });

  it('"power racks" → power_rack (and/or squat via capability path)', () => {
    const f = parseQueryLocally("power racks", CITY);
    expect(
      f.equipment.keys.includes("power_rack") || f.equipment.keys.includes("squat_rack"),
    ).toBe(true);
  });

  it('"rower" → rower', () => {
    expect(parseQueryLocally("rower", CITY).equipment.keys).toContain("rower");
  });

  it('"erg machine" → rower via erg synonym', () => {
    // "erg" alone is a rower synonym; "erg machine" keeps word-boundary on erg
    const f = parseQueryLocally("erg machine", CITY);
    expect(f.equipment.keys).toContain("rower");
  });

  it('"crossfit box" → crossfit preferred segment', () => {
    const f = parseQueryLocally("crossfit box", CITY);
    expect(f.preferredSegments).toContain("crossfit");
  });

  it('"spin class" → cycling preferred segment', () => {
    const f = parseQueryLocally("spin class", CITY);
    expect(f.preferredSegments).toContain("cycling");
  });

  it('"barre studio" → barre preferred segment', () => {
    const f = parseQueryLocally("barre studio", CITY);
    expect(f.preferredSegments).toContain("barre");
  });
});

describe("parseQueryLocally — 24h synonyms still hit", () => {
  it('"24/7" sets open24h', () => {
    const f = parseQueryLocally("24/7 gym", CITY);
    expect(f.open24h).toBe(true);
  });

  it('"24 hour" sets open24h', () => {
    const f = parseQueryLocally("24 hour access", CITY);
    expect(f.open24h).toBe(true);
  });
});
