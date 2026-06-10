import type { GymSegment, ScoredGym } from "@/lib/types/scout";
import { SEGMENT_LABELS } from "@/lib/types/scout";
import { parkingHeadline } from "@/lib/parking";

/** Escape every dynamic value interpolated into MapLibre-owned HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Segment hues — distinguishable on the light map, Waypoint-adjacent.
 *  Blaze is reserved for the SELECTED state. */
export const SEGMENT_PIN_COLORS: Record<GymSegment, string> = {
  strength: "#B65426",
  crossfit: "#2F6F69",
  big_box: "#1C2B36",
  boutique: "#7A5C8E",
  climbing: "#8F7B3A",
  yoga_pilates: "#4E7A4E",
  mma: "#74393B",
  recovery: "#3E768E",
  luxury: "#8A6F3D",
};

/**
 * DOM factory for MapLibre markers (not a React component — MapLibre owns
 * these elements). Waypoint pin: segment-colored teardrop, mono label —
 * match % when a query is active, else day-pass price, else a dot.
 */
export function pinLabel(gym: ScoredGym): string {
  if (gym.matchScore !== null) return String(gym.matchScore);
  if (gym.day_pass_price !== null) return `$${Number(gym.day_pass_price).toFixed(0)}`;
  return "•";
}

export function createWaypointPinElement(
  gym: ScoredGym,
  onClick: () => void,
): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "scout-pin";
  el.setAttribute("role", "button");
  el.setAttribute("tabindex", "0");
  el.setAttribute(
    "aria-label",
    `${gym.name}${gym.matchScore !== null ? `, ${gym.matchScore} percent match` : ""}`,
  );
  const bodyColor = gym.segment ? SEGMENT_PIN_COLORS[gym.segment] : "#1C2B36";
  // Static SVG shell (no text interpolation) + label set via textContent below.
  el.innerHTML = `
    <svg width="40" height="48" viewBox="0 0 40 48" fill="none" aria-hidden="true">
      <path class="scout-pin-body" d="M20 2.5C11 2.5 4.5 9 4.5 17.4 4.5 27 14.5 35 20 45.5 25.5 35 35.5 27 35.5 17.4 35.5 9 29 2.5 20 2.5Z"
        fill="${bodyColor}" stroke="#F1ECDF" stroke-width="2"/>
      <circle class="scout-pin-core" cx="20" cy="17.5" r="11.5" fill="#16242E"/>
    </svg>
    <span class="scout-pin-label"></span>
  `;
  const label = el.querySelector(".scout-pin-label");
  if (label) label.textContent = pinLabel(gym);
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  });
  return el;
}

export function setPinSelected(el: HTMLElement, selected: boolean): void {
  el.classList.toggle("scout-pin-selected", selected);
}

/** Popup card HTML (MapLibre popups live outside the React tree).
 *  All dynamic values are HTML-escaped via esc(). */
export function popupHtml(gym: ScoredGym): string {
  const price =
    gym.day_pass_price !== null
      ? `$${Number(gym.day_pass_price).toFixed(0)} day`
      : "Price unlisted";
  const segment = gym.segment ? SEGMENT_LABELS[gym.segment] : null;
  const segmentColor = gym.segment ? SEGMENT_PIN_COLORS[gym.segment] : "#1C2B36";
  const match =
    gym.matchScore !== null
      ? `<span style="font-family:var(--font-mono);font-size:10px;background:var(--color-blaze-deep);color:#fff;border-radius:4px;padding:2px 6px;letter-spacing:.05em;white-space:nowrap">${Math.round(gym.matchScore)} MATCH</span>`
      : "";
  const amenityChips = gym.amenities
    .filter((a) => a.present)
    .slice(0, 3)
    .map(
      (a) =>
        `<span style="font-family:var(--font-mono);font-size:9px;text-transform:uppercase;letter-spacing:.04em;border:1px solid #d9cfb4;border-radius:4px;padding:1.5px 5px;color:#4a5560">${esc(a.amenity_key.replace(/_/g, " "))}</span>`,
    )
    .join(" ");
  const primaryParking = gym.parking?.find((p) => p.is_primary);
  const parkingLine = primaryParking
    ? `<div style="margin-top:6px;font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:#4a5560">P · ${esc(parkingHeadline(primaryParking))}</div>`
    : "";
  const reasons =
    gym.matchReasons.length > 0
      ? `<div style="margin-top:7px;font-size:11px;color:#4a6058;line-height:1.45">${gym.matchReasons
          .slice(0, 2)
          .map((r) => `✓ ${esc(r)}`)
          .join("<br/>")}</div>`
      : "";
  return `
    <div style="padding:12px 14px;min-width:210px;max-width:250px">
      ${segment ? `<div style="font-family:var(--font-mono);font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:${segmentColor};font-weight:600;margin-bottom:3px">${esc(segment)}</div>` : ""}
      <div style="display:flex;gap:8px;align-items:flex-start;justify-content:space-between">
        <strong style="font-family:var(--font-display);font-size:14px;text-transform:uppercase;letter-spacing:.03em;color:var(--color-ink);line-height:1.15">${esc(gym.name)}</strong>
        ${match}
      </div>
      <div style="font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#5a6671;margin-top:4px">
        ${esc(gym.neighborhood ?? "")} · ${esc(price)}
      </div>
      ${amenityChips ? `<div style="margin-top:7px;display:flex;flex-wrap:wrap;gap:3px">${amenityChips}</div>` : ""}
      ${parkingLine}
      ${reasons}
      <a href="/gym/${encodeURIComponent(gym.slug)}" style="display:inline-block;margin-top:9px;font-family:var(--font-mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--color-blaze-deep);font-weight:600">View gym →</a>
    </div>`;
}
