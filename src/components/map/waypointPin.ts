import type { ScoredGym } from "@/lib/types/scout";

/** Escape every dynamic value interpolated into MapLibre-owned HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * DOM factory for MapLibre markers (not a React component — MapLibre owns
 * these elements). Waypoint-style pin: ink teardrop with a mono label —
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
  // Static SVG shell (no interpolation) + label set via textContent below.
  el.innerHTML = `
    <svg width="40" height="48" viewBox="0 0 40 48" fill="none" aria-hidden="true">
      <path class="scout-pin-body" d="M20 2.5C11 2.5 4.5 9 4.5 17.4 4.5 27 14.5 35 20 45.5 25.5 35 35.5 27 35.5 17.4 35.5 9 29 2.5 20 2.5Z"
        fill="#1C2B36" stroke="#F1ECDF" stroke-width="2"/>
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
  const match =
    gym.matchScore !== null
      ? `<span style="font-family:var(--font-mono);font-size:10px;background:var(--color-blaze);color:#fff;border-radius:4px;padding:2px 6px;letter-spacing:.05em">${Math.round(gym.matchScore)} MATCH</span>`
      : "";
  const reasons =
    gym.matchReasons.length > 0
      ? `<div style="margin-top:6px;font-size:11px;color:#5d6b66;line-height:1.45">${gym.matchReasons
          .slice(0, 2)
          .map((r) => `✓ ${esc(r)}`)
          .join("<br/>")}</div>`
      : "";
  return `
    <div style="padding:12px 14px;min-width:200px;max-width:240px">
      <div style="display:flex;gap:8px;align-items:flex-start;justify-content:space-between">
        <strong style="font-family:var(--font-display);font-size:14px;text-transform:uppercase;letter-spacing:.03em;color:var(--color-ink);line-height:1.15">${esc(gym.name)}</strong>
        ${match}
      </div>
      <div style="font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#6b7a76;margin-top:4px">
        ${esc(gym.neighborhood ?? "")} · ${esc(price)}
      </div>
      ${reasons}
      <a href="/gym/${encodeURIComponent(gym.slug)}" style="display:inline-block;margin-top:9px;font-family:var(--font-mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--color-blaze);font-weight:600">View gym →</a>
    </div>`;
}
