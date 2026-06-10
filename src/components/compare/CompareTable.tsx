"use client";

import Link from "next/link";
import { Check, Minus, X as XIcon } from "lucide-react";
import {
  EQUIPMENT_LABELS,
  SEGMENT_LABELS,
  type EnrichedGym,
  type EquipmentKey,
} from "@/lib/types/scout";

const AMENITY_LABELS: Record<string, string> = {
  sauna: "Sauna",
  cold_plunge: "Cold Plunge",
  steam_room: "Steam Room",
  pool: "Pool",
  recovery_room: "Recovery Room",
  open_24h: "24-Hour Access",
  classes: "Group Classes",
  personal_training: "Personal Training",
  turf_area: "Turf Area",
  cardio_zone: "Cardio Zone",
  basketball_court: "Basketball Court",
  day_pass: "Day Passes",
  parking: "Parking",
  lockers: "Locker Rooms",
  showers: "Showers",
  towel_service: "Towel Service",
  wifi: "Wi-Fi",
  juice_bar: "Juice Bar",
  childcare: "Childcare",
};

function Cell({ children, win = false }: { children: React.ReactNode; win?: boolean }) {
  return (
    <td
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

export function CompareTable({
  gyms,
  onRemove,
}: {
  gyms: EnrichedGym[];
  onRemove: (id: string) => void;
}) {
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

  return (
    <div className="overflow-x-auto rounded-xl border border-paper-line bg-paper-raise">
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr>
            <th className="readout sticky left-0 w-44 border-b border-paper-line bg-paper-raise px-3 py-3 text-left text-ink/50">
              Compare
            </th>
            {gyms.map((g) => (
              <th key={g.id} className="border-b border-paper-line px-3 py-3">
                <div className="flex flex-col items-center gap-1.5">
                  <Link
                    href={`/gym/${g.slug}`}
                    className="display text-center text-[14px] leading-tight tracking-wide text-ink hover:text-blaze"
                  >
                    {g.name}
                  </Link>
                  <button
                    type="button"
                    onClick={() => onRemove(g.id)}
                    className="readout text-ink/40 hover:text-blaze"
                  >
                    Remove
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th className="readout sticky left-0 bg-paper-raise px-3 py-2.5 text-left text-ink/60">Type</th>
            {gyms.map((g) => (
              <Cell key={g.id}>{g.segment ? SEGMENT_LABELS[g.segment] : "—"}</Cell>
            ))}
          </tr>
          <tr>
            <th className="readout sticky left-0 bg-paper-raise px-3 py-2.5 text-left text-ink/60">Neighborhood</th>
            {gyms.map((g) => (
              <Cell key={g.id}>{g.neighborhood ?? "—"}</Cell>
            ))}
          </tr>
          <tr>
            <th className="readout sticky left-0 bg-paper-raise px-3 py-2.5 text-left text-ink/60">Day pass</th>
            {gyms.map((g) => (
              <Cell
                key={g.id}
                win={g.day_pass_price !== null && Number(g.day_pass_price) === bestPrice}
              >
                <span className="font-mono text-xs uppercase">
                  {g.day_pass_price !== null
                    ? `$${Number(g.day_pass_price).toFixed(0)}`
                    : "Unlisted"}
                </span>
              </Cell>
            ))}
          </tr>
          <tr>
            <th className="readout sticky left-0 bg-paper-raise px-3 py-2.5 text-left text-ink/60">24-hour</th>
            {gyms.map((g) => (
              <Cell key={g.id} win={g.open_24h}>{g.open_24h ? <Yes /> : <No />}</Cell>
            ))}
          </tr>

          <tr>
            <th
              colSpan={gyms.length + 1}
              className="display sticky left-0 bg-ink px-3 py-2 text-left text-xs tracking-widest text-paper"
            >
              Amenities
            </th>
          </tr>
          {amenityKeys.map((key) => (
            <tr key={key}>
              <th className="readout sticky left-0 bg-paper-raise px-3 py-2.5 text-left text-ink/60">
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
                className="display sticky left-0 bg-ink px-3 py-2 text-left text-xs tracking-widest text-paper"
              >
                Equipment
              </th>
            </tr>
          )}
          {equipmentKeys.map((key) => (
            <tr key={key}>
              <th className="readout sticky left-0 bg-paper-raise px-3 py-2.5 text-left text-ink/60">
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
                      <Yes />
                    )}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
