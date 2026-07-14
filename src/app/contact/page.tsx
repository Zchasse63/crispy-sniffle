import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Building2, Mail, MessageSquare, Newspaper } from "lucide-react";
import { CONTACT_EMAIL, mailtoHref } from "@/lib/contactInfo";

export const metadata: Metadata = {
  title: "Contact — Scout",
  description:
    "Reach the Scout team for data corrections, gym ownership verification, feedback, or press.",
};

const REASONS = [
  {
    icon: Building2,
    label: "Data corrections",
    blurb: "Spot a wrong price, missing rack, or outdated hours? Tell us and we'll fix it.",
  },
  {
    icon: Mail,
    label: "Gym owners",
    blurb: "Run a gym listed on Scout? Verify it and take over the listing.",
  },
  {
    icon: MessageSquare,
    label: "Feedback",
    blurb: "Bugs, ideas, or a city you want Scout to map next.",
  },
  {
    icon: Newspaper,
    label: "Press",
    blurb: "Writing about Scout? We're happy to talk.",
  },
];

export default function ContactPage() {
  return (
    <div className="survey-grid mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <Link
        href="/"
        className="readout inline-flex items-center gap-1.5 text-ink/70 transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to Explore
      </Link>
      <p className="readout mt-6 text-pool">Get in touch</p>
      <h1 className="display mt-1 text-3xl text-ink sm:text-4xl">
        Talk to a person, not a form.
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-ink/80">
        Scout is a small team building an honest map of gyms. If something
        looks wrong, missing, or worth telling us about, email is the fastest
        way to reach us — a real person reads every message.
      </p>

      <ul className="mt-8 space-y-2.5">
        {REASONS.map(({ icon: Icon, label, blurb }) => (
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

      <div className="mt-9 rounded-xl border border-pool/30 bg-pool-tint/60 p-5 text-center">
        <p className="text-sm text-ink/80">Reach us at</p>
        <a
          href={mailtoHref("Scout contact")}
          className="display mt-2 inline-block text-xl text-pool-deep underline decoration-pool/40 underline-offset-4 hover:decoration-pool"
        >
          {CONTACT_EMAIL}
        </a>
      </div>

      <p className="mt-6 text-sm leading-relaxed text-ink/70">
        <b>Run a gym?</b> Mention it in your email and we&apos;ll send a
        verification link so you can claim and update your listing directly.
      </p>
    </div>
  );
}
