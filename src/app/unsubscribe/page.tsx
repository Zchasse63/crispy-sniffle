import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, CircleX } from "lucide-react";

export const metadata: Metadata = {
  title: "Unsubscribed — Scout",
};

/** Landing page for /api/unsubscribe's redirect. Any `ok` value other than
 *  "1" (missing, "0", a direct visit with no query param) reads as failure —
 *  there's no third state worth its own copy. */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const { ok } = await searchParams;
  const success = ok === "1";

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-4 py-20 text-center sm:px-6"
    >
      {success ? (
        <CircleCheck className="h-10 w-10 text-pool-deep" aria-hidden />
      ) : (
        <CircleX className="h-10 w-10 text-blaze-deep" aria-hidden />
      )}
      <h1 className="display mt-3 text-2xl text-ink sm:text-3xl">
        {success ? "You're unsubscribed" : "That link didn't work"}
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink/70">
        {success ? (
          "No more gym alerts headed your way."
        ) : (
          <>
            Email us via{" "}
            <Link
              href="/contact"
              className="font-semibold text-pool-deep underline decoration-pool/40 underline-offset-2"
            >
              /contact
            </Link>{" "}
            and we&apos;ll sort it out.
          </>
        )}
      </p>
    </main>
  );
}
