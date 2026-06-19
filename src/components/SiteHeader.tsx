"use client";

import { AuthButton } from "@/components/auth/AuthButton";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark } from "lucide-react";
import { SignalPin } from "@/components/brand/SignalPin";
import { useShortlistStore } from "@/stores/shortlistStore";

const NAV = [
  { href: "/", label: "Explore" },
  { href: "/trips", label: "Trips" },
  { href: "/compare", label: "Compare" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const count = useShortlistStore((s) => s.savedIds.length);
  const setDrawerOpen = useShortlistStore((s) => s.setDrawerOpen);

  // The owner form (/own/*) and the staff portal (/admin/*) use their own chrome.
  if (pathname.startsWith("/own") || pathname.startsWith("/admin")) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-paper-line bg-paper-raise/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-1.5 sm:gap-2" aria-label="Scout home">
          <span className="text-ink [&_svg]:h-8 [&_svg]:w-8 sm:[&_svg]:h-10 sm:[&_svg]:w-10">
            <SignalPin size={40} />
          </span>
          <span className="display text-lg tracking-wide text-ink sm:text-2xl">Scout</span>
          <span className="readout mt-1 hidden rounded-full border border-pool/40 bg-pool-tint px-2 py-0.5 text-pool-deep md:inline">
            Tampa Beta
          </span>
        </Link>

        <nav className="flex min-w-0 items-center gap-0.5 sm:gap-2" aria-label="Primary">
          {NAV.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`readout rounded-md px-1.5 py-2 transition-colors sm:px-3 ${
                  active ? "bg-ink text-paper" : "text-ink/70 hover:bg-paper hover:text-ink"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={`Open shortlist (${count} saved)`}
            className="relative ml-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-paper-line bg-paper-raise text-ink transition-colors hover:border-ink/40 sm:ml-1 sm:h-10 sm:w-10"
          >
            <Bookmark className="h-4.5 w-4.5" aria-hidden />
            {count > 0 && (
              <span className="font-mono absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blaze-deep px-1 text-[10px] font-semibold text-white">
                {count}
              </span>
            )}
          </button>
          <AuthButton />
        </nav>
      </div>
    </header>
  );
}
