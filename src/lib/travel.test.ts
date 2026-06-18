import { describe, it, expect } from "vitest";
import { pointInPolygon, type LngLat } from "./travel";

// A simple square shell from (0,0) to (10,10), MultiPolygon-shaped:
// number[][][][] = [ polygon ][ ring ][ vertex ][ lng,lat ]
const square = (x0: number, y0: number, x1: number, y1: number): number[][] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0],
];
const p = (lng: number, lat: number): LngLat => ({ lng, lat });

describe("pointInPolygon", () => {
  it("point inside a single polygon shell → true", () => {
    expect(pointInPolygon(p(5, 5), [[square(0, 0, 10, 10)]])).toBe(true);
  });

  it("point outside the shell → false", () => {
    expect(pointInPolygon(p(20, 20), [[square(0, 0, 10, 10)]])).toBe(false);
  });

  it("point inside a hole → false (donut)", () => {
    const donut = [square(0, 0, 10, 10), square(4, 4, 6, 6)]; // shell + hole
    expect(pointInPolygon(p(5, 5), [donut])).toBe(false); // in the hole
    expect(pointInPolygon(p(1, 1), [donut])).toBe(true); // in shell, outside hole
  });

  it("MultiPolygon: a hole in polygon A does NOT mask polygon B (island fix)", () => {
    // Polygon A is a donut whose hole sits at (5,5); Polygon B is a separate
    // island that happens to cover (5,5). Flat-merging rings would misread
    // B's shell as A's hole — per-polygon evaluation must return true.
    const donutA = [square(0, 0, 10, 10), square(4, 4, 6, 6)];
    const islandB = [square(4.5, 4.5, 5.5, 5.5)];
    expect(pointInPolygon(p(5, 5), [donutA, islandB])).toBe(true);
  });

  it("empty polygon set → false", () => {
    expect(pointInPolygon(p(5, 5), [])).toBe(false);
  });
});
