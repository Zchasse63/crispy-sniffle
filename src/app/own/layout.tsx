import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SignalPin } from "@/components/brand/SignalPin";

// The owner self-serve tree is private (token links only) — never index it.
export const metadata = { robots: { index: false, follow: false } };

/** Minimal chrome for the owner self-serve form — the form is the full focus
 *  (global SiteHeader/SiteFooter hide themselves on /own). */
export default function OwnLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="border-b border-paper-line bg-paper-raise/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <span className="flex items-center gap-2 text-ink">
            <span className="[&_svg]:h-7 [&_svg]:w-7">
              <SignalPin size={28} />
            </span>
            <span className="display text-lg tracking-wide">Scout</span>
          </span>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-ink/55 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to Scout
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
