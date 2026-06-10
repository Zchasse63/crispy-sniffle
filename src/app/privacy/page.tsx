import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy — Scout",
  description: "What Scout collects, why, and how to get it deleted.",
};

export default function PrivacyPage() {
  return (
    <div className="survey-grid mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <Link href="/" className="readout inline-flex items-center gap-1.5 text-ink/70 hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to Explore
      </Link>
      <h1 className="display mt-6 text-3xl text-ink">Privacy, plainly.</h1>
      <p className="font-mono mt-2 text-[10px] uppercase tracking-wider text-ink/55">
        Effective June 10, 2026 · Tampa beta
      </p>

      <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-ink/85">
        <section>
          <h2 className="display text-lg text-ink">What we collect</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
            <li><b>Email address</b> — if you sign in (magic link) or subscribe to gym alerts.</li>
            <li><b>Things you add</b> — saved gyms, trips, visit logs, reviews, photos you upload, fact confirmations, and training preferences.</li>
            <li><b>Search queries</b> — what you type or say into the search box, stored without any account linkage, to improve matching and decide which cities to map next.</li>
            <li><b>Location</b> — only if you tap "Near me," only in your browser, only to compute travel reach. Your coordinates are never stored on our servers.</li>
          </ul>
        </section>
        <section>
          <h2 className="display text-lg text-ink">What we don&apos;t do</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
            <li>No selling or sharing of personal data with third parties.</li>
            <li>No ad trackers, no fingerprinting, no third-party analytics scripts.</li>
            <li>No emails beyond what you opted into — and every alert email will carry an unsubscribe link.</li>
          </ul>
        </section>
        <section>
          <h2 className="display text-lg text-ink">Where it lives</h2>
          <p className="mt-2 text-sm">
            Data is stored with Supabase (Postgres, US region) behind row-level
            security — your private records (visits, follows, preferences) are
            readable only by your account. Reviews you post are public by design.
          </p>
        </section>
        <section>
          <h2 className="display text-lg text-ink">Deletion &amp; questions</h2>
          <p className="mt-2 text-sm">
            Email{" "}
            <a href="mailto:zchasse89@gmail.com?subject=Scout%20data%20request" className="font-semibold text-pool-deep underline decoration-pool/40 underline-offset-2">
              zchasse89@gmail.com
            </a>{" "}
            from your account address and we&apos;ll delete your account and every
            record tied to it, or export what we hold, within 30 days. Newsletter
            unsubscribes: same address, instant.
          </p>
        </section>
      </div>
    </div>
  );
}
