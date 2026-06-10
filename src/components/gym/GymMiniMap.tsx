import type { EnrichedGym } from "@/lib/types/scout";

/**
 * Static Waypoint-styled location map (Mapbox Static Images API).
 * A live GL instance per detail page was the heaviest thing on the page;
 * a styled image answers "where is it" at a fraction of the cost, and the
 * big interactive map is one tap away on Explore.
 */
const STYLE_PATH = (process.env.NEXT_PUBLIC_MAPBOX_STYLE ?? "mapbox://styles/mapbox/light-v11")
  .replace("mapbox://styles/", "");
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export function staticMapUrl(
  lng: number,
  lat: number,
  { width = 600, height = 256, zoom = 13.6 }: { width?: number; height?: number; zoom?: number } = {},
): string {
  // blaze-colored built-in pin; our SVG pins are DOM elements (GL-only)
  const pin = `pin-l+E1492F(${lng.toFixed(5)},${lat.toFixed(5)})`;
  return `https://api.mapbox.com/styles/v1/${STYLE_PATH}/static/${pin}/${lng.toFixed(5)},${lat.toFixed(5)},${zoom}/${width}x${height}@2x?access_token=${TOKEN}`;
}

export function GymMiniMap({ gym }: { gym: EnrichedGym }) {
  if (gym.lat === null || gym.lng === null || !TOKEN) return null;
  return (
    <div className="relative h-64 overflow-hidden rounded-xl border border-paper-line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={staticMapUrl(gym.lng, gym.lat)}
        alt={`Map showing the location of ${gym.name}`}
        className="h-full w-full object-cover"
        loading="lazy"
      />
      <span className="absolute bottom-1.5 right-2 text-[9px] text-ink/60">
        © Mapbox © OpenStreetMap
      </span>
    </div>
  );
}
