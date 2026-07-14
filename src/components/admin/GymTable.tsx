"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowUpDown, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import type { AdminGymRow } from "@/lib/admin/gyms-admin";
import { GYM_STATUS_LABELS, SEGMENT_LABELS } from "@/lib/types/scout";
import { Pill } from "@/components/admin/ui";

type SortKey = "name" | "city" | "completeness" | "rating" | "status";
const PAGE_SIZE = 50;

const STATUS_TONE: Record<string, "good" | "warn" | "bad" | "neutral"> = {
  active: "good",
  suspect: "warn",
  unverified_new: "warn",
  closed: "bad",
  moved: "neutral",
  duplicate: "neutral",
};

export function GymTable({ gyms }: { gyms: AdminGymRow[] }) {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [asc, setAsc] = useState(true);
  const [page, setPage] = useState(0); // 0-indexed

  const cities = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of gyms) if (g.cityName) m.set(g.cityId, g.cityName);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [gyms]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = gyms.filter((g) => {
      if (city !== "all" && g.cityId !== city) return false;
      if (status !== "all" && g.status !== status) return false;
      if (needle && !(`${g.name} ${g.cityName ?? ""}`.toLowerCase().includes(needle))) return false;
      return true;
    });
    const dir = asc ? 1 : -1;
    return filtered.sort((a, b) => {
      switch (sort) {
        case "city":
          return dir * (a.cityName ?? "").localeCompare(b.cityName ?? "");
        case "completeness":
          return dir * (a.completeness - b.completeness);
        case "rating":
          return dir * ((a.rating ?? -1) - (b.rating ?? -1));
        case "status":
          return dir * a.status.localeCompare(b.status);
        default:
          return dir * a.name.localeCompare(b.name);
      }
    });
  }, [gyms, q, city, status, sort, asc]);

  // Filter → sort (both above, unchanged) → paginate. Clamped independently of
  // the reset-on-filter handlers below so a stale page number can never slice
  // out of range (e.g. after the filtered set shrinks).
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const pageStart = pageSafe * PAGE_SIZE;
  const pageRows = rows.slice(pageStart, pageStart + PAGE_SIZE);
  const rangeLabel =
    rows.length === 0 ? "0 of 0" : `${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, rows.length)} of ${rows.length}`;

  function toggleSort(k: SortKey) {
    // Re-sorting reorders the same filtered set — it can never produce an
    // out-of-range page, so (unlike the filter handlers below) this doesn't
    // reset to page 0.
    if (sort === k) setAsc((v) => !v);
    else {
      setSort(k);
      setAsc(true);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Search name or city…"
            className="w-full rounded-md border border-paper-line bg-paper py-1.5 pl-8 pr-3 text-sm text-ink outline-none focus:border-pool"
          />
        </div>
        <select
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            setPage(0);
          }}
          className="rounded-md border border-paper-line bg-paper px-2.5 py-1.5 text-sm text-ink outline-none focus:border-pool"
        >
          <option value="all">All metros</option>
          {cities.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
          className="rounded-md border border-paper-line bg-paper px-2.5 py-1.5 text-sm text-ink outline-none focus:border-pool"
        >
          <option value="all">All statuses</option>
          {Object.entries(GYM_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <span className="readout text-xs text-mist">{rangeLabel}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-paper-line">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-paper-line bg-paper-raise text-left">
              <Th label="Gym" k="name" sort={sort} asc={asc} onSort={toggleSort} />
              <Th label="Metro" k="city" sort={sort} asc={asc} onSort={toggleSort} />
              <Th label="Segment" />
              <Th label="Status" k="status" sort={sort} asc={asc} onSort={toggleSort} />
              <Th label="Price" />
              <Th label="Rating" k="rating" sort={sort} asc={asc} onSort={toggleSort} />
              <Th label="Complete" k="completeness" sort={sort} asc={asc} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((g) => (
              <tr key={g.id} className="border-b border-paper-line/60 last:border-0 hover:bg-paper-raise/50">
                <td className="px-3 py-2">
                  <Link href={`/admin/gyms/${g.id}`} className="font-medium text-ink hover:text-pool-deep">
                    {g.name}
                  </Link>
                  {g.verified && (
                    <CheckCircle2 className="ml-1 inline h-3.5 w-3.5 text-pool" aria-label="verified" />
                  )}
                </td>
                <td className="px-3 py-2 text-mist">
                  {g.cityName ?? "—"}
                  {g.cityState ? `, ${g.cityState}` : ""}
                </td>
                <td className="px-3 py-2 text-mist">
                  {g.segment ? (SEGMENT_LABELS[g.segment] ?? g.segment) : "—"}
                </td>
                <td className="px-3 py-2">
                  <Pill tone={STATUS_TONE[g.status] ?? "neutral"}>{GYM_STATUS_LABELS[g.status]}</Pill>
                </td>
                <td className="px-3 py-2 text-mist">
                  {g.monthlyFrom !== null
                    ? `$${g.monthlyFrom}/mo`
                    : g.dayPass !== null
                      ? `$${g.dayPass} day`
                      : <span className="text-blaze-deep">no price</span>}
                </td>
                <td className="px-3 py-2 text-mist">
                  {g.rating !== null ? `${g.rating.toFixed(1)} (${g.ratingCount})` : "—"}
                </td>
                <td className="px-3 py-2">
                  <CompletenessBar value={g.completeness} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-sm text-mist">
                  No gyms match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs text-mist">
            Page {pageSafe + 1} of {pageCount}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={pageSafe === 0}
              className="flex items-center gap-1 rounded-md border border-paper-line px-2 py-1 text-xs text-mist hover:text-ink disabled:opacity-40 disabled:hover:text-mist"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={pageSafe >= pageCount - 1}
              className="flex items-center gap-1 rounded-md border border-paper-line px-2 py-1 text-xs text-mist hover:text-ink disabled:opacity-40 disabled:hover:text-mist"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({
  label,
  k,
  sort,
  asc,
  onSort,
}: {
  label: string;
  k?: SortKey;
  sort?: SortKey;
  asc?: boolean;
  onSort?: (k: SortKey) => void;
}) {
  if (!k || !onSort) {
    return <th className="px-3 py-2 readout text-[11px] uppercase tracking-wider text-mist">{label}</th>;
  }
  const active = sort === k;
  return (
    <th className="px-3 py-2">
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`readout flex items-center gap-1 text-[11px] uppercase tracking-wider ${active ? "text-ink" : "text-mist"}`}
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40"}`} />
        {active && <span className="sr-only">{asc ? "ascending" : "descending"}</span>}
      </button>
    </th>
  );
}

function CompletenessBar({ value }: { value: number }) {
  const tone = value >= 70 ? "bg-pool" : value >= 40 ? "bg-blaze" : "bg-blaze-deep";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-paper-line">
        <div className={`h-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums text-mist">{value}%</span>
    </div>
  );
}
