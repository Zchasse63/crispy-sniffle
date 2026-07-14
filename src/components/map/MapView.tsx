"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Feature, FeatureCollection, Point } from "geojson";
import type { ScoredGym } from "@/lib/types/scout";
import {
  createWaypointPinElement,
  pinLabel,
  popupHtml,
  setPinSelected,
} from "./waypointPin";

// Scout Waypoint custom style (authored via Styles API); light-v11 fallback
const STYLE_URL =
  process.env.NEXT_PUBLIC_MAPBOX_STYLE ?? "mapbox://styles/mapbox/light-v11";
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// Metro-scale ceiling fix: only the top-ranked gyms get a full DOM marker
// (price label, popup, keyboard operability). Everything else lives in a
// native mapbox geojson cluster source — no per-gym DOM node, no ceiling.
const RANKED_PIN_LIMIT = 40;
const CLUSTER_SOURCE_ID = "scout-gyms-cluster";
const CLUSTERS_LAYER_ID = "scout-gyms-clusters";
const CLUSTER_COUNT_LAYER_ID = "scout-gyms-cluster-count";
const UNCLUSTERED_LAYER_ID = "scout-gyms-unclustered";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

/** Minimal, primitive-only properties — nested arrays (amenities, equipment…)
 *  aren't safe to round-trip through a geojson source, so click handlers
 *  look the full gym back up by id (see gymByIdRef) instead of trusting
 *  whatever comes back off the feature. */
function toFeatureCollection(gyms: ScoredGym[]): FeatureCollection<Point, { id: string }> {
  const features: Feature<Point, { id: string }>[] = [];
  for (const gym of gyms) {
    if (gym.lat === null || gym.lng === null) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [gym.lng, gym.lat] },
      properties: { id: gym.id },
    });
  }
  return { type: "FeatureCollection", features };
}

export function MapView({
  gyms,
  selectedGymId,
  onGymSelect,
  center = [-82.4572, 27.9506], // generic fallback default — DiscoveryClient always passes an explicit city center ([city.lng, city.lat])
  zoom = 11.2,
}: {
  gyms: ScoredGym[];
  selectedGymId: string | null;
  onGymSelect: (id: string | null) => void;
  center?: [number, number];
  zoom?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLDivElement }>>(
    new Map(),
  );
  const sourceRef = useRef<mapboxgl.GeoJSONSource | null>(null);
  // The one popup opened from the cluster tier (unclustered-point clicks).
  // Ranked-pin clicks stopPropagate (see the marker-rebuild effect below),
  // which starves this popup's own default closeOnClick — so a ranked-pin
  // click has to close it explicitly, or it's left dangling on the map.
  const loosePopupRef = useRef<mapboxgl.Popup | null>(null);
  // Full gym lookup (id -> gym) for cluster-layer clicks, whose GeoJSON
  // properties only carry a bare id. Kept current every render (cheap map
  // rebuild) so click handlers registered once at style-load never go stale.
  const gymByIdRef = useRef<Map<string, ScoredGym>>(new Map());
  useEffect(() => {
    gymByIdRef.current = new Map(gyms.map((g) => [g.id, g]));
  }, [gyms]);
  // Latest gyms, for the async 'load' handler that seeds the cluster source
  // — by the time the style finishes loading, several renders may have
  // already passed the initial (possibly empty) gyms prop.
  const latestGymsRef = useRef<ScoredGym[]>(gyms);
  useEffect(() => {
    latestGymsRef.current = gyms;
  }, [gyms]);
  // Latest onGymSelect, read from map event handlers set up ONCE at style
  // load — avoids stale closures without forcing marker/source rebuild
  // effects to depend on (and re-run for) a prop identity that can change
  // more often than the gym set itself.
  const onGymSelectRef = useRef(onGymSelect);
  useEffect(() => {
    onGymSelectRef.current = onGymSelect;
  }, [onGymSelect]);

  // init once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center,
      zoom,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }));
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    // Snapshot for the cleanup below — markersRef.current is always this
    // same Map instance for the component's life (only ever mutated, never
    // reassigned), but ESLint can't know that statically.
    const markers = markersRef.current;

    // The container is now toggled visible/hidden via CSS (mobile list/map
    // tab, desktop split view) instead of being mounted/unmounted — mapbox's
    // own trackResize only listens for *window* resizes, so a container
    // going from display:none to block (0×0 -> real size) would otherwise
    // leave the canvas stuck at its stale dimensions.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    // CLUSTERING: native mapbox geojson source (cluster: true) for every gym
    // beyond the top-N ranked DOM pins — circle + count layers for clusters,
    // a small circle layer for lone unclustered points. addSource/addLayer
    // require the style to be loaded.
    const setupClusterLayer = () => {
      if (map.getSource(CLUSTER_SOURCE_ID)) return; // StrictMode / double 'load' guard
      map.addSource(CLUSTER_SOURCE_ID, {
        type: "geojson",
        data: toFeatureCollection(latestGymsRef.current.slice(RANKED_PIN_LIMIT)),
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 14,
      });
      sourceRef.current = map.getSource<mapboxgl.GeoJSONSource>(CLUSTER_SOURCE_ID) ?? null;

      map.addLayer({
        id: CLUSTERS_LAYER_ID,
        type: "circle",
        source: CLUSTER_SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#5C6F7A",
            20,
            "#33495A",
            75,
            "#1C2B36",
          ],
          "circle-radius": ["step", ["get", "point_count"], 14, 20, 18, 75, 23],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#F1ECDF",
        },
      });
      map.addLayer({
        id: CLUSTER_COUNT_LAYER_ID,
        type: "symbol",
        source: CLUSTER_SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
        paint: { "text-color": "#F1ECDF" },
      });
      map.addLayer({
        id: UNCLUSTERED_LAYER_ID,
        type: "circle",
        source: CLUSTER_SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#1C2B36",
          "circle-radius": 6,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#F1ECDF",
        },
      });

      map.on("mouseenter", CLUSTERS_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", CLUSTERS_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", UNCLUSTERED_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", UNCLUSTERED_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });

      // Click-to-zoom: the only per-cluster interaction a canvas layer can
      // offer (no per-feature DOM node exists to attach a keyboard handler
      // to). The map's own default keyboard nav (+/- and arrow keys once the
      // canvas has focus, never disabled here) is the "at minimum a keyboard
      // path" for this tier — ranked DOM pins keep the full role=button/
      // aria-label/Enter-Space rigor below.
      map.on("click", CLUSTERS_LAYER_ID, (e) => {
        const feature = e.features?.[0];
        const clusterId = feature?.properties?.cluster_id;
        const source = sourceRef.current;
        if (!feature || clusterId === undefined || clusterId === null || !source) return;
        source.getClusterExpansionZoom(clusterId, (err, targetZoom) => {
          if (err || targetZoom === null || targetZoom === undefined) return;
          const coords = (feature.geometry as Point).coordinates as [number, number];
          if (prefersReducedMotion()) {
            map.jumpTo({ center: coords, zoom: targetZoom });
          } else {
            map.flyTo({ center: coords, zoom: targetZoom });
          }
        });
      });

      map.on("click", UNCLUSTERED_LAYER_ID, (e) => {
        const feature = e.features?.[0];
        const id = feature?.properties?.id as string | undefined;
        if (!feature || !id) return;
        onGymSelectRef.current(id);
        const gym = gymByIdRef.current.get(id);
        if (gym) {
          loosePopupRef.current?.remove();
          const popup = new mapboxgl.Popup({ offset: 12, closeButton: true })
            .setLngLat((feature.geometry as Point).coordinates as [number, number])
            .setHTML(popupHtml(gym))
            .addTo(map);
          popup.on("close", () => {
            if (loosePopupRef.current === popup) loosePopupRef.current = null;
          });
          loosePopupRef.current = popup;
        }
      });
    };
    if (map.isStyleLoaded()) setupClusterLayer();
    else map.once("load", setupClusterLayer);

    return () => {
      resizeObserver.disconnect();
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      sourceRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Top-N ranked DOM price pins — rebuilt ONLY when the ordered top-N id set
  // changes (a sort/filter change can swap which gyms rank in the top N even
  // when the underlying result set doesn't gain or lose a single gym).
  const topGyms = gyms.slice(0, RANKED_PIN_LIMIT);
  const topGymIdsKey = topGyms.map((g) => g.id).join(",");
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();

    // fan out gyms sharing a building (identical coords) so every pin is hittable
    const seenCoords = new Map<string, number>();
    for (const gym of topGyms) {
      if (gym.lat === null || gym.lng === null) continue;
      const coordKey = `${gym.lat.toFixed(4)},${gym.lng.toFixed(4)}`;
      const dupIndex = seenCoords.get(coordKey) ?? 0;
      seenCoords.set(coordKey, dupIndex + 1);
      const lng = gym.lng + (dupIndex > 0 ? 0.0011 * Math.ceil(dupIndex / 2) * (dupIndex % 2 ? 1 : -1) : 0);

      // single activation path for mouse AND keyboard: highlight + popup.
      // (our stopPropagation starves MapLibre's own popup handling, so we
      // own the popup lifecycle; the marker doesn't exist yet when the
      // element is created, hence the late-bound callback)
      let activate: () => void = () => {};
      const el = createWaypointPinElement(gym, () => activate());
      // Hover mirrors the card grid's onHover (transient — direction 1 of
      // the two-way sync); click below is additionally sticky via the popup.
      el.addEventListener("mouseenter", () => onGymSelectRef.current(gym.id));
      el.addEventListener("mouseleave", () => onGymSelectRef.current(null));
      const popup = new mapboxgl.Popup({ offset: 30, closeButton: true }).setHTML(
        popupHtml(gym),
      );
      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([lng, gym.lat])
        .setPopup(popup)
        .addTo(map);
      activate = () => {
        onGymSelectRef.current(gym.id);
        // this click stopPropagates (see comment above), which starves the
        // cluster tier's own closeOnClick — close any dangling loose popup
        // explicitly so the two tiers never stack popups.
        loosePopupRef.current?.remove();
        marker.togglePopup();
      };
      markersRef.current.set(gym.id, { marker, el });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topGymIdsKey]);

  // Clustered/unclustered layer data — refreshed only when SET MEMBERSHIP of
  // the non-ranked tail changes (order doesn't matter for clustering, so a
  // re-sort among gyms ranked 41+ that doesn't cross the rank cutoff is a
  // no-op here). If the source isn't ready yet, 'load' seeds it fresh from
  // latestGymsRef, so no update is lost.
  const restGymIdsKey = gyms
    .slice(RANKED_PIN_LIMIT)
    .map((g) => g.id)
    .sort()
    .join(",");
  useEffect(() => {
    const source = sourceRef.current;
    if (!source) return;
    source.setData(toFeatureCollection(gyms.slice(RANKED_PIN_LIMIT)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restGymIdsKey]);

  // selection sync (list hover ↔ pin highlight) — top-N ranked pins only;
  // gyms beyond the rank cutoff have no DOM pin to highlight.
  useEffect(() => {
    markersRef.current.forEach(({ el }, id) => setPinSelected(el, id === selectedGymId));
  }, [selectedGymId]);

  // scores change in place: update pin labels + popup content, no rebuild
  useEffect(() => {
    for (const gym of topGyms) {
      const entry = markersRef.current.get(gym.id);
      if (!entry) continue;
      const label = entry.el.querySelector(".scout-pin-label");
      if (label) label.textContent = pinLabel(gym);
      entry.marker.getPopup()?.setHTML(popupHtml(gym));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gyms]);

  return <div ref={containerRef} className="h-full w-full" />;
}
