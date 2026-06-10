/**
 * Mapbox travel math — isochrones ("within X minutes"), travel-time
 * matrices (trips ranked by drive time), forward geocoding (lodging).
 * Client-safe: public token, no server-only imports. All helpers return
 * null on failure — travel features degrade, never break, the page.
 */
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export type TravelMode = "driving" | "walking";
export interface LngLat {
  lng: number;
  lat: number;
}

/** Isochrone polygons for `minutes` around origin — an ARRAY of polygons
 *  (each [shell, ...holes]). Driving isochrones around Tampa's bay split
 *  into MultiPolygons routinely; merging their rings misreads island
 *  shells as holes. */
export async function fetchIsochrone(
  origin: LngLat,
  minutes: number,
  mode: TravelMode,
): Promise<number[][][][] | null> {
  if (!TOKEN) return null;
  try {
    const url =
      `https://api.mapbox.com/isochrone/v1/mapbox/${mode}/${origin.lng},${origin.lat}` +
      `?contours_minutes=${Math.round(minutes)}&polygons=true&access_token=${TOKEN}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const data = await res.json();
    const geom = data?.features?.[0]?.geometry;
    if (geom?.type === "Polygon") return [geom.coordinates as number[][][]];
    if (geom?.type === "MultiPolygon") return geom.coordinates as number[][][][];
    return null;
  } catch {
    return null;
  }
}

/** Ray-cast point-in-MultiPolygon: inside any polygon's shell and not in
 *  one of THAT polygon's holes. */
export function pointInPolygon(point: LngLat, polygons: number[][][][]): boolean {
  const inRing = (ring: number[][]): boolean => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (
        yi > point.lat !== yj > point.lat &&
        point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi
      ) {
        inside = !inside;
      }
    }
    return inside;
  };
  return polygons.some((rings) => {
    if (rings.length === 0 || !inRing(rings[0])) return false;
    for (let h = 1; h < rings.length; h++) if (inRing(rings[h])) return false;
    return true;
  });
}

/** Driving minutes from origin to each destination (Matrix API, chunked —
 *  25 coordinates per request). Returns id → minutes; failures omitted. */
export async function fetchTravelMinutes(
  origin: LngLat,
  destinations: { id: string; lng: number; lat: number }[],
  mode: TravelMode = "driving",
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!TOKEN || destinations.length === 0) return out;
  for (let i = 0; i < destinations.length; i += 24) {
    const chunk = destinations.slice(i, i + 24);
    const coords = [
      `${origin.lng},${origin.lat}`,
      ...chunk.map((d) => `${d.lng},${d.lat}`),
    ].join(";");
    try {
      const url =
        `https://api.mapbox.com/directions-matrix/v1/mapbox/${mode}/${coords}` +
        `?sources=0&annotations=duration&access_token=${TOKEN}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      const data = await res.json();
      const durations: (number | null)[] = data?.durations?.[0] ?? [];
      chunk.forEach((d, idx) => {
        const sec = durations[idx + 1]; // index 0 is origin→origin
        if (typeof sec === "number") out.set(d.id, Math.round(sec / 60));
      });
    } catch {
      // chunk failed — its gyms simply show no travel time
    }
  }
  return out;
}

/** Forward-geocode a lodging address/place, biased to the destination city. */
export async function geocodeLodging(
  query: string,
  near?: LngLat,
): Promise<{ label: string; lng: number; lat: number } | null> {
  if (!TOKEN || query.trim().length < 3) return null;
  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query.trim())}.json` +
      `?limit=1&types=address,poi,place&access_token=${TOKEN}` +
      (near ? `&proximity=${near.lng},${near.lat}` : "");
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const data = await res.json();
    const f = data?.features?.[0];
    if (!f?.center) return null;
    return { label: f.place_name ?? query, lng: f.center[0], lat: f.center[1] };
  } catch {
    return null;
  }
}
