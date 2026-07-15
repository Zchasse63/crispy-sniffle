"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Dumbbell,
  Inbox,
  Map as MapIcon,
  MessageSquareWarning,
  PenLine,
  LineChart,
  CircleDollarSign,
  Settings,
  Palette,
  type LucideIcon,
} from "lucide-react";
import { Pill } from "@/components/admin/ui";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** prefix match (any deeper route highlights the parent) */
  match?: string;
  /** deferred / gated — rendered dimmed with a tag */
  soon?: boolean;
  /** which count (passed down from the layout's cheap head-count query) badges this item */
  countKey?: "ownerQueue" | "moderation" | "corrections";
}

interface NavGroup {
  section: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    section: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    section: "Catalog",
    items: [
      { href: "/admin/gyms", label: "Gyms", icon: Dumbbell, match: "/admin/gyms" },
      { href: "/admin/data-quality", label: "Data Quality", icon: LineChart, match: "/admin/data-quality" },
    ],
  },
  {
    section: "Submissions",
    items: [
      {
        href: "/admin/owner-queue",
        label: "Owner Queue",
        icon: Inbox,
        match: "/admin/owner-queue",
        countKey: "ownerQueue",
      },
      { href: "/admin/invites", label: "Invites", icon: Inbox, match: "/admin/invites" },
    ],
  },
  {
    section: "Metros & Pipeline",
    items: [
      { href: "/admin/metros", label: "Metros", icon: MapIcon, match: "/admin/metros" },
      { href: "/admin/runs", label: "Pipeline Runs", icon: MapIcon, match: "/admin/runs" },
    ],
  },
  {
    section: "Community",
    items: [
      {
        href: "/admin/moderation",
        label: "Moderation",
        icon: MessageSquareWarning,
        match: "/admin/moderation",
        countKey: "moderation",
      },
      {
        href: "/admin/moderation/corrections",
        label: "Corrections",
        icon: PenLine,
        match: "/admin/moderation/corrections",
        countKey: "corrections",
      },
    ],
  },
  {
    section: "Growth",
    items: [{ href: "/admin/analytics", label: "Analytics", icon: LineChart, match: "/admin/analytics", soon: true }],
  },
  {
    section: "Monetization",
    items: [{ href: "/admin/revenue", label: "Revenue", icon: CircleDollarSign, match: "/admin/revenue", soon: true }],
  },
  {
    section: "System",
    items: [
      { href: "/admin/icon-lab", label: "Icon Lab", icon: Palette, match: "/admin/icon-lab" },
      { href: "/admin/audit", label: "Audit", icon: Settings, match: "/admin/audit" },
      { href: "/admin/flags", label: "Flags & Config", icon: Settings, match: "/admin/flags" },
      { href: "/admin/access", label: "Staff & Roles", icon: Settings, match: "/admin/access" },
      { href: "/admin/system", label: "Ops & Health", icon: Settings, match: "/admin/system" },
    ],
  },
];

function matches(pathname: string, item: NavItem): boolean {
  if (item.match) {
    // exact dashboard is handled separately; prefix match for the rest
    return pathname === item.match || pathname.startsWith(item.match + "/");
  }
  return pathname === item.href;
}

/** Nav now has a nested pair — Corrections' href sits under Moderation's own
 *  match prefix (/admin/moderation/corrections vs. /admin/moderation) — so a
 *  per-item prefix check alone would light up BOTH on the Corrections page.
 *  Resolve globally: only the single longest-matching item is active. */
function activeHref(pathname: string): string | null {
  const all = NAV.flatMap((g) => g.items).filter((item) => matches(pathname, item));
  if (all.length === 0) return null;
  return all.reduce((a, b) => ((b.match ?? b.href).length > (a.match ?? a.href).length ? b : a)).href;
}

export function AdminNav({
  ownerQueueCount,
  moderationCount,
  correctionsCount,
}: {
  /** Pending owner submissions (null = count query unavailable, never a fabricated 0). */
  ownerQueueCount?: number | null;
  /** Reported + hidden reviews (null = count query unavailable). */
  moderationCount?: number | null;
  /** fact_confirmations rows with verdict='correct' (null = count query unavailable). */
  correctionsCount?: number | null;
}) {
  const pathname = usePathname();
  const counts: Record<"ownerQueue" | "moderation" | "corrections", number | null | undefined> = {
    ownerQueue: ownerQueueCount,
    moderation: moderationCount,
    corrections: correctionsCount,
  };
  const active = activeHref(pathname);
  return (
    <nav className="flex flex-col gap-5 px-3 py-4" aria-label="Admin sections">
      {NAV.map((group) => (
        <div key={group.section}>
          <p className="readout px-2 pb-1.5 text-[10px] uppercase tracking-widest text-mist">
            {group.section}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const isItemActive = item.href === active;
              const Icon = item.icon;
              // A null (query failed) or zero (queue clear) count never renders a
              // badge — only a real pending count competes visually for attention.
              const count = item.countKey ? counts[item.countKey] : undefined;
              const showBadge = typeof count === "number" && count > 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isItemActive ? "page" : undefined}
                    className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                      isItemActive
                        ? "bg-pool-tint font-semibold text-pool-deep"
                        : "text-mist hover:bg-paper-line/60 hover:text-ink"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {showBadge && <Pill tone="warn">{count}</Pill>}
                    {item.soon && (
                      <span className="readout rounded-full border border-paper-line px-1.5 py-px text-[9px] uppercase tracking-wide text-mist">
                        Soon
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
