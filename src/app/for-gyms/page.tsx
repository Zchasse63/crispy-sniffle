import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Building2, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { mailtoHref } from "@/lib/contactInfo";

/** Placeholder subject the owner naturally edits before sending — this page has
 *  no gym context of its own (unlike the per-gym CommunitySection CTA), so we
 *  can't prefill a real name. The bracket reads as "fill this in," not a bug. */
const REQUEST_SUBJECT = "Owner link request: [gym name]";
const REQUEST_BODY = "Gym name: \nYour role (owner, manager, GM, etc.): \n";

export async function generateMetadata(): Promise<Metadata> {
  const title = "For gym owners — Scout";
  const description =
    "Run a gym listed on Scout? Confirm your own pricing, hours, and equipment — owner-confirmed facts outrank everything else on your listing, plus the Owner Listed and Gym Verified badges.";
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

const WHAT_YOU_GET = [
  {
    icon: Building2,
    label: "Owner Listed",
    blurb:
      "Confirm the basics — pricing, hours, amenities — and they outrank scraped data on your listing right away.",
  },
  {
    icon: ShieldCheck,
    label: "Gym Verified",
    blurb:
      "Add equipment and a few more details to earn Scout's strongest trust signal — the badge members look for first.",
  },
];

const HOW_IT_WORKS = [
  {
    n: 1,
    label: "Request your link",
    blurb:
      "Email us your gym's name and your role. We'll reply with a private link tied to your gym — not indexed, not guessable.",
  },
  {
    n: 2,
    label: "Confirm your facts",
    blurb:
      "The short path takes about 5 minutes — pricing, hours, amenities. Save your progress anytime and pick up later; nothing is shared until you submit.",
  },
  {
    n: 3,
    label: "Staff review",
    blurb: "We check what you send and update your listing — usually within 2 business days.",
  },
];

export default function ForGymsPage() {
  return (
    <div className="survey-grid mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <Link
        href="/"
        className="readout inline-flex items-center gap-1.5 text-ink/70 transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to Explore
      </Link>

      <p className="readout mt-6 text-pool">For gym owners</p>
      <h1 className="display mt-1 text-3xl text-ink sm:text-4xl">
        Your gym&apos;s facts, straight from you.
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-ink/80">
        Scout lists gyms from public research — websites, listings, whatever we could verify
        ourselves. That&apos;s a reasonable starting point, but it&apos;s never as current as you
        are. Confirm your own pricing, hours, and equipment, and{" "}
        <b>those facts outrank everything else on your listing</b> — scraped data, our own
        research, all of it.
      </p>

      <h2 className="display mt-9 text-xl text-ink">What you get</h2>
      <ul className="mt-4 space-y-2.5">
        {WHAT_YOU_GET.map(({ icon: Icon, label, blurb }) => (
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

      <h2 className="display mt-9 text-xl text-ink">How it works</h2>
      <ol className="mt-4 space-y-2.5">
        {HOW_IT_WORKS.map(({ n, label, blurb }) => (
          <li
            key={n}
            className="flex items-start gap-3 rounded-xl border border-paper-line bg-paper-raise p-4"
          >
            <span className="display mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] text-paper">
              {n}
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">{label}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink/70">{blurb}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-9 rounded-xl border border-pool/30 bg-pool-tint/60 p-5">
        <p className="text-sm font-semibold text-ink">Ready to claim your listing?</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink/80">
          Email us your gym&apos;s name and your role — owner, manager, GM, whoever handles the
          listing — and we&apos;ll send back a private link to confirm your facts.
        </p>
        <a
          href={mailtoHref(REQUEST_SUBJECT, REQUEST_BODY)}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-raise"
        >
          <Mail className="h-4 w-4" aria-hidden /> Request your owner link
        </a>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink/55">
          <Smartphone className="h-3.5 w-3.5 shrink-0" aria-hidden /> Works great on your phone —
          no app to download.
        </p>
      </div>
    </div>
  );
}
