import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { POSTS } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Field Notes — the Scout blog",
  description:
    "Guides grounded in Scout's verified Tampa gym data: equipment deep-dives, pricing math, and how to find a gym that fits.",
};

export default function BlogIndex() {
  return (
    <div className="survey-grid mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <Link
        href="/"
        className="readout inline-flex items-center gap-1.5 text-ink/70 transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to Explore
      </Link>
      <p className="readout mt-6 text-pool">Field notes</p>
      <h1 className="display mt-1 text-3xl text-ink sm:text-4xl">
        Guides from the gym map.
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink/80">
        Everything here is grounded in the same verified data that powers
        Scout — real prices, real equipment lists, no filler.
      </p>
      <ul className="mt-8 space-y-4">
        {POSTS.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/blog/${p.slug}`}
              className="block rounded-xl border border-paper-line bg-paper-raise p-5 transition-all hover:-translate-y-0.5 hover:border-ink/30"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink/55">
                {new Date(`${p.date}T12:00:00`).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              <h2 className="display mt-1.5 text-xl leading-snug text-ink">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink/75">{p.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
