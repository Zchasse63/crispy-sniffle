import { redirect } from "next/navigation";
import Link from "next/link";
import { getStaff } from "@/lib/admin/auth";
import { SignalPin } from "@/components/brand/SignalPin";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scout Admin", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  // Already authenticated staff skip the form.
  const staff = await getStaff();
  if (staff) redirect("/admin");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="text-ink [&_svg]:h-8 [&_svg]:w-8">
            <SignalPin size={32} />
          </span>
          <span className="display text-2xl tracking-wide text-ink">Scout</span>
          <span className="readout rounded-full border border-paper-line px-2 py-0.5 text-[10px] uppercase tracking-widest text-mist">
            Admin
          </span>
        </Link>
        <div className="rounded-xl border border-paper-line bg-paper-raise p-6">
          <h1 className="mb-1 text-lg font-semibold text-ink">Staff sign-in</h1>
          <p className="mb-4 text-xs text-mist">Operator access only. This area is not public.</p>
          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
