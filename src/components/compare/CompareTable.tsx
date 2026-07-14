"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Clock, ExternalLink, Minus, Navigation, X as XIcon } from "lucide-react";
import {
  AMENITY_LABELS,
  DROP_IN_LABELS,
  EQUIPMENT_LABELS,
  SEGMENT_LABELS,
  type EnrichedGym,
  type EquipmentKey,
} from "@/lib/types/scout";
import { parkingSummary } from "@/lib/parking";
import { formatPrice } from "@/lib/access";
import { openStatus, type OpenStatus } from "@/lib/hours";


function Cell({
  children,
  win = false,
  title,
}: {
  children: React.ReactNode;
  win?: boolean;
  title?: string;
}) {
  return (
    <td
      title={title}
      className={`border-b border-paper-line/70 px-3 py-2.5 text-center text-sm ${
        win ? "bg-pool-tint/60" : ""
      }`}
    >
      {children}
    </td>
  );
}

const Yes = () => <Check className="mx-auto h-4 w-4 text-pool" aria-label="Yes" />;
const No = () => <XIcon className="mx-auto h-4 w-4 text-contour" aria-label="No" />;
const Unknown = () => <Minus className="mx-auto h-4 w-4 text-paper-line" aria-label="Unknown" />;

/** Same maps-link convention as the gym detail page (app/gym/[slug]/page.tsx)
 *  — no shared lib exists for it there either, so this mirrors it inline
 *  rather than inventing a new cross-surface helper. Never fabricated: null
 *  when neither coordinates nor an address exist. */
function directionsUrlFor(gym: EnrichedGym): string | null {
  if (gym.lat !== null && gym.lng !== null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${gym.lat},${gym.lng}`;
  }
  if (gym.address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${gym.name}, ${gym.address}`)}`;
  }
  return null;
}

export function CompareTable({ gyms }: { gyms: EnrichedGym[] }) {
  const amenityKeys = [
    ...new Set(gyms.flatMap((g) => g.amenities.filter((a) => a.present).map((a) => a.amenity_key))),
  ];
  const equipmentKeys = [
    ...new Set(gyms.flatMap((g) => g.equipment.map((e) => e.equipment_key))),
  ] as EquipmentKey[];

  const prices = gyms.map((g) => (g.day_pass_price !== null ? Number(g.day_pass_price) : null));
  const bestPrice = prices.some((p) => p !== null)
    ? Math.min(...prices.filter((p): p is number => p !== null))
    : null;
  const weekPrices = gyms.map((g) => (g.week_pass_price !== null ? Number(g.week_pass_price) : null));
  const bestWeekPrice = weekPrices.some((p) => p !== null)
    ? Math.min(...weekPrices.filter((p): p is number => p !== null))
    : null;

  // Open-now is time-dependent → client-only after mount (same rAF-deferred
  // pattern as GymCard, built on the single hours source of truth in
  // lib/hours.ts / scorer.ts isOpenNow — never forked).
  const [statuses, setStatuses] = useState<Record<string, OpenStatus | null>>({});
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const next: Record<string, OpenStatus | null> = {};
      for (const g of gyms) next[g.id] = openStatus(g.hours);
      setStatuses(next);
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gyms.map((g) => g.id).join(",")]);

  return (
    <div>
      <div className="readout mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-ink/70">
        <span className="inline-flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-pool" aria-hidden /> has it
        </span>
        <span className="inline-flex items-center gap-1.5">
          <XIcon className="h-3.5 w-3.5 text-contour" aria-hidden /> doesn&apos;t
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Minus className="h-3.5 w-3.5 text-paper-line" aria-hidden /> unknown — not on file yet
        </span>
      </div>
      {/* Sticky headers, fixed: the previous wrapper used overflow-x-auto only.
          Per the CSS overflow spec, setting overflow-x to anything but
          "visible" forces the OTHER axis's computed value from "visible" to
          "auto" too — so this div was already a scroll container on both
          axes, it just never actually scrolled vertically (no height cap,
          so its scrollport == its full content height). position:sticky
          sticks relative to the nearest scroll-container ancestor, so the
          thead was pinned relative to a box that never moved; the PAGE's
          own scroll carried the whole div (sticky child included) off
          screen instead. Capping the height below and using `overflow-auto`
          makes this div a genuine dual-axis scrollport, so both `top-0`
          (header row) and `left-0` (label column) stickiness now have a
          real scroll offset to react to. Verified against the full ~40-row
          amenity/equipment body. */}
      <div className="max-h-[70vh] overflow-auto rounded-xl border border-paper-line bg-paper-raise">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr>
              <th className="readout sticky left-0 top-0 z-30 w-44 border-b border-paper-line bg-paper-raise px-3 py-3 text-left text-ink/70">
                Compare
              </th>
              {gyms.map((g) => {
                const directions = directionsUrlFor(g);
                return (
                  <th
                    key={g.id}
                    className="sticky top-0 z-20 border-b border-paper-line bg-paper-raise px-3 py-3"
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <Link
                        href={`/gym/${g.slug}`}
                        className="display text-center text-[14px] leading-tight tracking-wide text-ink hover:text-blaze"
                      >
                        {g.name}
                      </Link>
                      <div className="flex items-center gap-2.5">
                        <Link
                          href={`/gym/${g.slug}`}
                          title="View gym"
                          aria-label={`View ${g.name}`}
                          className="readout inline-flex items-center gap-1 text-ink/40 hover:text-blaze"
                        >
                          <ExternalLink className="h-3 w-3" aria-hidden /> View
                        </Link>
                        {directions && (
                          <a
                            href={directions}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Directions"
                            aria-label={`Directions to ${g.name}`}
                            className="readout inline-flex items-center gap-1 text-ink/40 hover:text-blaze"
                          >
                            <Navigation className="h-3 w-3" aria-hidden /> Directions
                          </a>
                        )}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className="readout sticky left-0 z-10 bg-paper-raise px-3 py-2.5 text-left text-ink/70">Open now</th>
              {gyms.map((g) => {
                const status = statuses[g.id];
                return (
                  <Cell key={g.id}>
                    {status ? (
                      <span
                        className={`inline-flex items-center justify-center gap-1 text-xs ${
                          status.closingSoon
                            ? "font-semibold text-blaze-deep"
                            : status.open
                              ? "text-pool-deep"
                              : "text-ink/60"
                        }`}
                      >
                        <Clock className="h-3 w-3" aria-hidden />
                        {status.label}
                      </span>
                    ) : (
                      "—"
                    )}
                  </Cell>
                );
              })}
            </tr>
            <tr>
              <th className="readout sticky left-0 z-10 bg-paper-raise px-3 py-2.5 text-left text-ink/70">Type</th>
              {gyms.map((g) => (
                <Cell key={g.id}>{g.segment ? SEGMENT_LABELS[g.segment] : "—"}</Cell>
              ))}
            </tr>
            <tr>
              <th className="readout sticky left-0 z-10 bg-paper-raise px-3 py-2.5 text-left text-ink/70">Neighborhood</th>
              {gyms.map((g) => (
                <Cell key={g.id}>{g.neighborhood ?? "—"}</Cell>
              ))}
            </tr>
            <tr>
              <th className="readout sticky left-0 z-10 bg-paper-raise px-3 py-2.5 text-left text-ink/70">Address</th>
              {gyms.map((g) => (
                <Cell key={g.id}>
                  {g.address ? <span className="text-xs">{g.address}</span> : "—"}
                </Cell>
              ))}
            </tr>
            <tr>
              <th className="readout sticky left-0 z-10 bg-paper-raise px-3 py-2.5 text-left text-ink/70">Day pass</th>
              {gyms.map((g) => (
                <Cell
                  key={g.id}
                  win={g.day_pass_price !== null && Number(g.day_pass_price) === bestPrice}
                >
                  <span className="font-mono text-xs uppercase">
                    {g.day_pass_price !== null
                      ? `$${formatPrice(Number(g.day_pass_price))}`
                      : "Unlisted"}
                  </span>
                </Cell>
              ))}
            </tr>
            <tr>
              <th className="readout sticky left-0 z-10 bg-paper-raise px-3 py-2.5 text-left text-ink/70">Week pass</th>
              {gyms.map((g) => (
                <Cell
                  key={g.id}
                  win={g.week_pass_price !== null && Number(g.week_pass_price) === bestWeekPrice}
                >
                  <span className="font-mono text-xs uppercase">
                    {g.week_pass_price !== null
                      ? `$${formatPrice(Number(g.week_pass_price))}`
                      : "Unlisted"}
                  </span>
                </Cell>
              ))}
            </tr>
            <tr>
              <th className="readout sticky left-0 z-10 bg-paper-raise px-3 py-2.5 text-left text-ink/70">Monthly from</th>
              {gyms.map((g) => (
                <Cell key={g.id} title={g.monthly_note ?? undefined}>
                  <span className="font-mono text-xs uppercase">
                    {g.monthly_from !== null
                      ? `$${formatPrice(Number(g.monthly_from))}/mo`
                      : "Unlisted"}
                  </span>
                </Cell>
              ))}
            </tr>
            <tr>
              <th className="readout sticky left-0 z-10 bg-paper-raise px-3 py-2.5 text-left text-ink/70">Drop-in</th>
              {gyms.map((g) => (
                <Cell key={g.id} title={g.drop_in_note ?? undefined}>
                  {g.drop_in_policy ? DROP_IN_LABELS[g.drop_in_policy] : "—"}
                </Cell>
              ))}
            </tr>
            <tr>
              <th className="readout sticky left-0 z-10 bg-paper-raise px-3 py-2.5 text-left text-ink/70">Parking</th>
              {gyms.map((g) => {
                const summary = parkingSummary(g.parking);
                return (
                  <Cell key={g.id}>
                    {summary ? <span className="text-xs">{summary.headline}</span> : "—"}
                  </Cell>
                );
              })}
            </tr>
            <tr>
              <th className="readout sticky left-0 z-10 bg-paper-raise px-3 py-2.5 text-left text-ink/70">24-hour</th>
              {gyms.map((g) => (
                <Cell key={g.id} win={g.open_24h}>{g.open_24h ? <Yes /> : <No />}</Cell>
              ))}
            </tr>

            <tr>
              <th
                colSpan={gyms.length + 1}
                className="display sticky left-0 z-10 bg-ink px-3 py-2 text-left text-xs tracking-widest text-paper"
              >
                Amenities
              </th>
            </tr>
            {amenityKeys.map((key) => (
              <tr key={key}>
                <th className="readout sticky left-0 z-10 bg-paper-raise px-3 py-2.5 text-left text-ink/70">
                  {AMENITY_LABELS[key] ?? key}
                </th>
                {gyms.map((g) => {
                  const rec = g.amenities.find((a) => a.amenity_key === key);
                  return (
                    <Cell key={g.id}>
                      {rec ? rec.present ? <Yes /> : <No /> : <Unknown />}
                    </Cell>
                  );
                })}
              </tr>
            ))}

            {equipmentKeys.length > 0 && (
              <tr>
                <th
                  colSpan={gyms.length + 1}
                  className="display sticky left-0 z-10 bg-ink px-3 py-2 text-left text-xs tracking-widest text-paper"
                >
                  Equipment
                </th>
              </tr>
            )}
            {equipmentKeys.map((key) => (
              <tr key={key}>
                <th className="readout sticky left-0 z-10 bg-paper-raise px-3 py-2.5 text-left text-ink/70">
                  {EQUIPMENT_LABELS[key]}
                </th>
                {gyms.map((g) => {
                  const rec = g.equipment.find((e) => e.equipment_key === key);
                  if (!rec) return <Cell key={g.id}><Unknown /></Cell>;
                  const bits = [
                    rec.quantity && rec.quantity > 1 ? `${rec.quantity}×` : null,
                    rec.max_weight_lbs ? `${rec.max_weight_lbs} lbs` : null,
                    rec.brand,
                  ].filter(Boolean);
                  return (
                    <Cell key={g.id}>
                      {bits.length > 0 ? (
                        <span className="font-mono text-[11px] uppercase tracking-wide text-ink/80">
                          {bits.join(" · ")}
                        </span>
                      ) : (
                        <span title="Has it — count/spec not on file yet">
                          <Yes />
                        </span>
                      )}
                    </Cell>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
