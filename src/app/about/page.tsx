import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Building2, CircleHelp, Database, Globe, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "How Scout's data works — Scout",
  description:
    "Every fact in Scout carries its source and confidence. Here's the verification ladder, what the labels mean, and why we never invent details.",
};

const LADDER = [
  {
    icon: BadgeCheck,
    label: "Scout Verified",
    blurb: "Confirmed by the Scout team — the gold standard.",
  },
  {
    icon: Building2,
    label: "Owner Listed",
    blurb: "Provided by the facility itself.",
  },
  {
    icon: Users,
    label: "User Confirmed",
    blurb: "Backed up by people who've actually trained there.",
  },
  {
    icon: Globe,
    label: "Web Data",
    blurb: "Extracted from the facility's site and public sources.",
  },
  {
    icon: Database,
    label: "Scout Data",
    blurb: "From our curated launch research — web-verified to exist, details best-effort.",
  },
  {
    icon: CircleHelp,
    label: "Estimated",
    blurb: "A conservative inference (e.g., racks imply barbells) — always labeled, never passed off as confirmed.",
  },
];

export default function AboutPage() {
  return (
    <div className="survey-grid mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <Link
        href="/"
        className="readout inline-flex items-center gap-1.5 text-ink/70 transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to Explore
      </Link>
      <p className="readout mt-6 text-pool">Data honesty</p>
      <h1 className="display mt-1 text-3xl text-ink sm:text-4xl">
        Every fact carries its source.
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-ink/80">
        Finding the right gym means trusting the details — the rack count, the
        dumbbell run, whether the sauna actually exists. Scout&apos;s rule is
        simple: <b>we&apos;d rather say &ldquo;unknown&rdquo; than make something
        up.</b> Prices we can&apos;t confirm say <i>unlisted</i>. Cities we
        haven&apos;t mapped say <i>limited data</i>. And every attribute on every
        gym page carries a source label and a confidence level.
      </p>

      <h2 className="display mt-9 text-xl text-ink">The verification ladder</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink/70">
        Facts climb this ladder over time — owner confirmations and member
        reports upgrade what our research seeded.
      </p>
      <ul className="mt-4 space-y-2.5">
        {LADDER.map(({ icon: Icon, label, blurb }) => (
          <li
            key={label}
            className="flex items-start gap-3 rounded-xl border border-paper-line bg-paper-raise p-4"
          >
            <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-pool-deep" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-ink">{label}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink/70">{blurb}</p>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="display mt-9 text-xl text-ink">Where parking data comes from</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink/80">
        Parking recommendations are assembled from the gym&apos;s own published
        guidance (labeled Web Data), OpenStreetMap&apos;s community-mapped parking
        inventory (labeled OpenStreetMap, used under the{" "}
        <a
          href="https://opendatacommons.org/licenses/odbl/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-pool-deep underline decoration-pool/40 underline-offset-2 hover:decoration-pool"
        >
          ODbL license
        </a>
        ), city open data where applicable, and clearly-labeled inferences (a
        strip-plaza gym almost always has a customer lot). Walking times are
        approximate — and absence of data never means absence of parking.
      </p>

      <h2 className="display mt-9 text-xl text-ink">The match score</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink/80">
        When you search, Scout&apos;s AI only translates your words into
        structured requirements. The score itself is computed deterministically
        from the data — weighted coverage of what you asked for, with the
        reasons (and the misses) spelled out on every card. No black box, no
        invented numbers.
      </p>

      <div className="mt-9 rounded-xl border border-pool/30 bg-pool-tint/60 p-5">
        <p className="text-sm leading-relaxed text-ink">
          <b>Tampa is our beta quadrant.</b> Spot something wrong, or want Scout
          in your city?{" "}
          <Link
            href="/contact"
            className="font-semibold text-pool-deep underline decoration-pool/40 underline-offset-2 hover:decoration-pool"
          >
            Tell us
          </Link>
          {" "}— corrections make the map better for everyone.
        </p>
      </div>
    </div>
  );
}
