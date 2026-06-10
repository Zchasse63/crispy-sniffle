"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ScoredGym } from "@/lib/types/scout";
import {
  createWaypointPinElement,
  pinLabel,
  popupHtml,
  setPinSelected,
} from "./waypointPin";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export function MapView({
  gyms,
  selectedGymId,
  onGymSelect,
  center = [-82.4572, 27.9506], // Tampa
  zoom = 11.2,
}: {
  gyms: ScoredGym[];
  selectedGymId: string | null;
  onGymSelect: (id: string | null) => void;
  center?: [number, number];
  zoom?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLDivElement }>>(
    new Map(),
  );

  // init once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center,
      zoom,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    return () => {
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // markers are rebuilt ONLY when the set of gyms changes (not on every
  // score/filter re-render — that caused full marker churn per keystroke)
  const gymIdsKey = gyms.map((g) => g.id).join(",");
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();

    // fan out gyms sharing a building (identical coords) so every pin is hittable
    const seenCoords = new Map<string, number>();
    for (const gym of gyms) {
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
      const popup = new maplibregl.Popup({ offset: 30, closeButton: true }).setHTML(
        popupHtml(gym),
      );
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([lng, gym.lat])
        .setPopup(popup)
        .addTo(map);
      activate = () => {
        onGymSelect(gym.id);
        marker.togglePopup();
      };
      markersRef.current.set(gym.id, { marker, el });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymIdsKey, onGymSelect]);

  // selection sync (list hover ↔ pin highlight)
  useEffect(() => {
    markersRef.current.forEach(({ el }, id) => setPinSelected(el, id === selectedGymId));
  }, [selectedGymId]);

  // scores change in place: update pin labels + popup content, no rebuild
  useEffect(() => {
    for (const gym of gyms) {
      const entry = markersRef.current.get(gym.id);
      if (!entry) continue;
      const label = entry.el.querySelector(".scout-pin-label");
      if (label) label.textContent = pinLabel(gym);
      entry.marker.getPopup()?.setHTML(popupHtml(gym));
    }
  }, [gyms]);

  return <div ref={containerRef} className="h-full w-full" />;
}
