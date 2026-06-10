import Link from "next/link";
import { NewsletterForm } from "@/components/NewsletterForm";
import { SignalPin } from "@/components/brand/SignalPin";

export function SiteFooter() {
  return (
    <footer className="survey-grid-night mt-auto border-t border-ink-line bg-ink-deep">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5 text-paper">
              <SignalPin size={44} />
              <span className="display text-2xl tracking-wide">Scout</span>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-mist">
              AI-powered gym discovery. Honest data, explainable matches —
              the equipment, amenities, and hours that actually matter.
            </p>
            <p className="readout mt-3 text-pool">Find your fit.</p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:gap-14">
            <div>
              <h3 className="readout text-mist/80">Scout</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/" className="text-paper/85 transition-colors hover:text-paper">Explore</Link></li>
                <li><Link href="/trips" className="text-paper/85 transition-colors hover:text-paper">Trips</Link></li>
                <li><Link href="/compare" className="text-paper/85 transition-colors hover:text-paper">Compare</Link></li>
                <li><Link href="/about" className="text-paper/85 transition-colors hover:text-paper">How our data works</Link></li>
                <li><Link href="/blog" className="text-paper/85 transition-colors hover:text-paper">Field notes</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="readout text-mist/80">Beta</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <a
                    href="mailto:zchasse89@gmail.com?subject=Scout%20feedback"
                    className="text-paper/85 transition-colors hover:text-paper"
                  >
                    Send feedback
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:zchasse89@gmail.com?subject=Bring%20Scout%20to%20my%20city"
                    className="text-paper/85 transition-colors hover:text-paper"
                  >
                    Want your city next?
                  </a>
                </li>
                <li className="mt-3"><p className="readout mb-1.5 text-paper/70">Gym alerts</p><NewsletterForm /></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-ink-line pt-5">
          <p className="readout text-mist/85">
            Tampa quadrant · 27.9506° N · 82.4572° W
          </p>
          <p className="readout text-mist/85">© 2026 Scout · Tampa beta</p>
        </div>
      </div>
    </footer>
  );
}
