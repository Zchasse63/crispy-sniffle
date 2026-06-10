import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms — Scout",
  description: "The short, honest terms for using Scout's Tampa beta.",
};

export default function TermsPage() {
  return (
    <div className="survey-grid mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <Link href="/" className="readout inline-flex items-center gap-1.5 text-ink/70 hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to Explore
      </Link>
      <h1 className="display mt-6 text-3xl text-ink">Terms, briefly.</h1>
      <p className="font-mono mt-2 text-[10px] uppercase tracking-wider text-ink/55">
        Effective June 10, 2026 · Tampa beta
      </p>

      <div className="mt-6 space-y-5 text-sm leading-relaxed text-ink/85">
        <p>
          <b>Scout is a discovery tool, not the gyms themselves.</b> We work hard
          to keep facts honest — every one carries its source and confidence —
          but hours, prices, equipment, and policies belong to the gyms and can
          change without notice. Confirm anything critical with the gym before
          you drive. Scout isn&apos;t liable for decisions made on listed data.
        </p>
        <p>
          <b>Your contributions.</b> Reviews, photos, visit logs, and fact
          confirmations you submit must be yours, truthful, and lawful. By
          posting, you give Scout a license to display them. We hide content
          that gets reported and remove anything abusive; one review per gym
          per person.
        </p>
        <p>
          <b>Your account.</b> Sign-in is by email magic link. You&apos;re
          responsible for your inbox; we&apos;re responsible for not doing
          anything creepy with your address (see{" "}
          <Link href="/privacy" className="font-semibold text-pool-deep underline decoration-pool/40 underline-offset-2">
            Privacy
          </Link>
          ).
        </p>
        <p>
          <b>Beta reality.</b> This is a free beta: features may change, data
          may have gaps (they&apos;re labeled), and the service is provided
          as-is, without warranties. Maps © Mapbox © OpenStreetMap; parking and
          transit data © OpenStreetMap contributors (ODbL).
        </p>
        <p>
          <b>Contact.</b>{" "}
          <a href="mailto:zchasse89@gmail.com?subject=Scout%20terms" className="font-semibold text-pool-deep underline decoration-pool/40 underline-offset-2">
            zchasse89@gmail.com
          </a>
          . Florida law governs.
        </p>
      </div>
    </div>
  );
}
