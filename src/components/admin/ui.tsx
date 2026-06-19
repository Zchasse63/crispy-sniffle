import Link from "next/link";
import type { ReactNode } from "react";
import { PROVENANCE_META } from "@/lib/types/scout";
import type { ProvenanceSource } from "@/lib/types/scout";

type Tone = "neutral" | "good" | "warn" | "bad" | "info";

const TONE_BG: Record<Tone, string> = {
  neutral: "border-paper-line bg-paper-raise text-mist",
  good: "border-pool/30 bg-pool-tint text-pool-deep",
  warn: "border-blaze/30 bg-blaze-tint text-blaze-deep",
  bad: "border-blaze/40 bg-blaze-tint text-blaze-deep",
  info: "border-contour/30 bg-paper-raise text-contour-deep",
};

const DOT_TONE: Record<Tone, string> = {
  neutral: "bg-mist",
  good: "bg-pool",
  warn: "bg-blaze",
  bad: "bg-blaze-deep",
  info: "bg-contour",
};

/** Page header: title + optional description + right-aligned actions. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-paper-line pb-4">
      <div className="min-w-0">
        <h1 className="display text-2xl tracking-wide text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-mist">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Card / panel container. */
export function Panel({
  children,
  className = "",
  title,
  actions,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-paper-line bg-paper-raise ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-paper-line px-4 py-3">
          {title && <h2 className="readout text-xs uppercase tracking-widest text-mist">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Dashboard stat tile, optionally linking into a section. */
export function StatTile({
  label,
  value,
  sub,
  tone = "neutral",
  href,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <div className="flex h-full flex-col rounded-xl border border-paper-line bg-paper-raise p-4 transition-colors hover:border-pool/40">
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${DOT_TONE[tone]}`} aria-hidden />
        <p className="readout text-[10px] uppercase tracking-widest text-mist">{label}</p>
      </div>
      <p className="display mt-2 text-3xl tracking-wide text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-mist">{sub}</p>}
    </div>
  );
  return href ? (
    <Link
      href={href}
      className="block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pool"
    >
      {body}
    </Link>
  ) : (
    body
  );
}

/** Small status pill. */
export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE_BG[tone]}`}
    >
      {children}
    </span>
  );
}

/** Provenance source tag using the shared ladder labels. */
export function ProvenancePill({ source }: { source: ProvenanceSource }) {
  const meta = PROVENANCE_META[source];
  const tone: Tone = meta.rank >= 5 ? "good" : meta.rank >= 3 ? "info" : "neutral";
  return <Pill tone={tone}>{meta.label}</Pill>;
}

/** Empty-state block. */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-4 py-12 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="max-w-sm text-xs text-mist">{hint}</p>}
    </div>
  );
}

/** Button-styled link for primary actions. */
export function ActionLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
}) {
  const cls =
    variant === "primary"
      ? "bg-ink text-paper hover:bg-ink-deep"
      : "border border-paper-line text-ink hover:border-pool/40";
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${cls}`}
    >
      {children}
    </Link>
  );
}
