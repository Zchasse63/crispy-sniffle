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

  // markers follow the scored gym list
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();

    for (const gym of gyms) {
      if (gym.lat === null || gym.lng === null) continue;
      const el = createWaypointPinElement(gym, () => onGymSelect(gym.id));
      const popup = new maplibregl.Popup({ offset: 30, closeButton: true }).setHTML(
        popupHtml(gym),
      );
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([gym.lng, gym.lat])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.set(gym.id, { marker, el });
    }
  }, [gyms, onGymSelect]);

  // selection sync (list hover ↔ pin highlight)
  useEffect(() => {
    markersRef.current.forEach(({ el }, id) => setPinSelected(el, id === selectedGymId));
  }, [selectedGymId]);

  // keep labels current when scores change without re-creating markers
  useEffect(() => {
    for (const gym of gyms) {
      const entry = markersRef.current.get(gym.id);
      const label = entry?.el.querySelector(".scout-pin-label");
      if (label) label.textContent = pinLabel(gym);
    }
  }, [gyms]);

  return <div ref={containerRef} className="h-full w-full" />;
}
