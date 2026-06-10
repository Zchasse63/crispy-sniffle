"use client";

import Link from "next/link";
import { Check, Minus, X as XIcon } from "lucide-react";
import {
  AMENITY_LABELS,
  DROP_IN_LABELS,
  EQUIPMENT_LABELS,
  SEGMENT_LABELS,
  type EnrichedGym,
  type EquipmentKey,
} from "@/lib/types/scout";
import { parkingSummary } from "@/lib/parking";


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
    <div className="overflow-x-auto rounded-xl border border-paper-line bg-paper-raise">
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr>
            {/* note: vertical sticky doesn't survive the overflow-x container;
                only the horizontal left-0 stick is real */}
            <th className="readout sticky left-0 w-44 border-b border-paper-line bg-paper-raise px-3 py-3 text-left text-ink/70">
              Compare
            </th>
            {gyms.map((g) => (
              <th key={g.id} className="border-b border-paper-line bg-paper-raise px-3 py-3">
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
            <th className="readout sticky left-0 bg-paper-raise px-3 py-2.5 text-left text-ink/70">Type</th>
            {gyms.map((g) => (
              <Cell key={g.id}>{g.segment ? SEGMENT_LABELS[g.segment] : "—"}</Cell>
            ))}
          </tr>
          <tr>
            <th className="readout sticky left-0 bg-paper-raise px-3 py-2.5 text-left text-ink/70">Neighborhood</th>
            {gyms.map((g) => (
              <Cell key={g.id}>{g.neighborhood ?? "—"}</Cell>
            ))}
          </tr>
          <tr>
            <th className="readout sticky left-0 bg-paper-raise px-3 py-2.5 text-left text-ink/70">Day pass</th>
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
            <th className="readout sticky left-0 bg-paper-raise px-3 py-2.5 text-left text-ink/70">Monthly from</th>
            {gyms.map((g) => (
              <Cell key={g.id} title={g.monthly_note ?? undefined}>
                <span className="font-mono text-xs uppercase">
                  {g.monthly_from !== null
                    ? `$${Number(g.monthly_from) % 1 === 0 ? Number(g.monthly_from).toFixed(0) : Number(g.monthly_from).toFixed(2)}/mo`
                    : "Unlisted"}
                </span>
              </Cell>
            ))}
          </tr>
          <tr>
            <th className="readout sticky left-0 bg-paper-raise px-3 py-2.5 text-left text-ink/70">Drop-in</th>
            {gyms.map((g) => (
              <Cell key={g.id} title={g.drop_in_note ?? undefined}>
                {g.drop_in_policy ? DROP_IN_LABELS[g.drop_in_policy] : "—"}
              </Cell>
            ))}
          </tr>
          <tr>
            <th className="readout sticky left-0 bg-paper-raise px-3 py-2.5 text-left text-ink/70">Parking</th>
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
            <th className="readout sticky left-0 bg-paper-raise px-3 py-2.5 text-left text-ink/70">24-hour</th>
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
              <th className="readout sticky left-0 bg-paper-raise px-3 py-2.5 text-left text-ink/70">
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
              <th className="readout sticky left-0 bg-paper-raise px-3 py-2.5 text-left text-ink/70">
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
