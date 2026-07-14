import { notFound } from "next/navigation";
import Link from "next/link";
import { getStaff } from "@/lib/admin/auth";
import { SignalPin } from "@/components/brand/SignalPin";
import { AdminNav } from "@/components/admin/AdminNav";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { Pill } from "@/components/admin/ui";

// Staff portal is always live data; never statically cached.
export const dynamic = "force-dynamic";

// The whole staff app tree is noindex/nofollow (previously only /admin/login was).
export const metadata = { robots: { index: false, follow: false } };

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  reviewer: "Reviewer",
  viewer: "Viewer",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaff();
  // Non-staff (and signed-out) get a 404 — the surface never advertises itself.
  if (!staff) notFound();

  return (
    <div className="flex min-h-dvh bg-paper text-ink">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-r border-paper-line bg-paper-raise/60 md:flex">
        <Link href="/admin" className="flex items-center gap-2 border-b border-paper-line px-4 py-4">
          <span className="text-ink [&_svg]:h-7 [&_svg]:w-7">
            <SignalPin size={28} />
          </span>
          <span className="display text-lg tracking-wide text-ink">Scout</span>
          <span className="readout rounded-full border border-paper-line px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-mist">
            Admin
          </span>
        </Link>
        <AdminNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-paper-line bg-paper/90 px-4 py-2.5 backdrop-blur-md">
          {/* mobile brand */}
          <Link href="/admin" className="flex items-center gap-1.5 md:hidden">
            <SignalPin size={22} />
            <span className="display text-base tracking-wide">Scout Admin</span>
          </Link>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2.5">
            <span className="hidden text-xs text-mist sm:inline">{staff.email}</span>
            <Pill tone={staff.role === "owner" ? "good" : "info"}>{ROLE_LABEL[staff.role] ?? staff.role}</Pill>
            <SignOutButton />
          </div>
        </header>
        <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
