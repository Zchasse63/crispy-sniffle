"use client";

/** Dollar amount. Empty → null (we never fabricate a $0). Mono font for data. */
export function CurrencyInput({
  id,
  value,
  onChange,
  placeholder = "unlisted",
  prefilled = false,
}: {
  id?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  prefilled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-ink/50">
          $
        </span>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") return onChange(null);
            const n = Number(v);
            // Guard: a typo (NaN) or negative must NOT silently blank/poison the
            // most-filtered field. Ignore invalid input, keep the prior value.
            if (!Number.isFinite(n) || n < 0) return;
            onChange(Math.round(n * 100) / 100);
          }}
          className="font-mono w-36 rounded-lg border border-paper-line bg-paper-raise py-2 pl-7 pr-3 text-sm text-ink placeholder:font-sans placeholder:text-ink/35 focus:border-ink/40 focus:outline-none"
        />
      </div>
      {prefilled && value != null && (
        <span className="readout text-pool-deep" title="from your website">
          • from your site
        </span>
      )}
    </div>
  );
}
