"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, AlertTriangle } from "lucide-react";
import type { ParsedFact } from "@/lib/owner/parse";
import { describeValue } from "@/lib/owner/parse";

type Decision = "publish" | "reject";

export function SubmissionReview({
  submissionId,
  facts,
  actionable,
}: {
  submissionId: string;
  facts: ParsedFact[];
  actionable: boolean;
}) {
  const router = useRouter();
  const [decisions, setDecisions] = useState<Record<string, Decision>>(
    () => Object.fromEntries(facts.map((f) => [f.key, "publish" as Decision])),
  );
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy] = useState<null | string>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const acceptCount = useMemo(
    () => facts.filter((f) => decisions[f.key] !== "reject").length,
    [facts, decisions],
  );

  function toggle(key: string) {
    setDecisions((d) => ({ ...d, [key]: d[key] === "reject" ? "publish" : "reject" }));
  }

  async function run(kind: "publish" | "reject" | "needs_info") {
    setBusy(kind);
    setMsg(null);
    try {
      const url =
        kind === "publish"
          ? `/admin/api/owner-queue/${submissionId}/publish`
          : `/admin/api/owner-queue/${submissionId}`;
      const payload =
        kind === "publish" ? { decisions, reviewNote } : { action: kind, reviewNote };
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ tone: "err", text: json.error ?? "Action failed" });
      } else {
        setMsg({
          tone: "ok",
          text:
            kind === "publish"
              ? `Published ${json.published} fact(s), rejected ${json.rejected}.`
              : kind === "reject"
                ? "Submission rejected."
                : "Flagged as needs-info.",
        });
        router.refresh();
      }
    } catch {
      setMsg({ tone: "err", text: "Network error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-paper-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-paper-line bg-paper-raise text-left">
              <th className="px-3 py-2 readout text-[11px] uppercase tracking-wider text-mist">Field</th>
              <th className="px-3 py-2 readout text-[11px] uppercase tracking-wider text-mist">Current</th>
              <th className="px-3 py-2 readout text-[11px] uppercase tracking-wider text-mist">Owner says</th>
              {actionable && (
                <th className="px-3 py-2 readout text-[11px] uppercase tracking-wider text-mist">Decision</th>
              )}
            </tr>
          </thead>
          <tbody>
            {facts.map((f) => {
              const rejected = decisions[f.key] === "reject";
              return (
                <tr
                  key={f.key}
                  className={`border-b border-paper-line/60 last:border-0 ${rejected ? "opacity-50" : ""} ${
                    f.conflict ? "bg-blaze-tint/30" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {f.conflict && <AlertTriangle className="h-3.5 w-3.5 text-blaze" aria-label="conflict" />}
                      <span className="font-medium text-ink">{f.label}</span>
                    </div>
                    <span className="readout text-[10px] uppercase tracking-wide text-mist">{f.group}</span>
                  </td>
                  <td className="px-3 py-2 text-mist">{describeValue(f.target, f.oldValue) || "Unlisted"}</td>
                  <td className={`px-3 py-2 ${f.conflict ? "font-medium text-blaze-deep" : "text-ink"}`}>
                    {f.target.type === "photos" ? (
                      <PhotoStrip value={f.newValue} />
                    ) : (
                      describeValue(f.target, f.newValue)
                    )}
                  </td>
                  {actionable && (
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggle(f.key)}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${
                          rejected
                            ? "border-paper-line text-mist"
                            : "border-pool/40 bg-pool-tint text-pool-deep"
                        }`}
                      >
                        {rejected ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                        {rejected ? "Rejected" : "Accept"}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {facts.length === 0 && (
              <tr>
                <td colSpan={actionable ? 4 : 3} className="px-3 py-8 text-center text-sm text-mist">
                  This submission has no parsed facts.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {actionable && (
        <div className="mt-4 rounded-xl border border-paper-line bg-paper-raise p-4">
          <label className="mb-2 block">
            <span className="readout text-[11px] uppercase tracking-widest text-mist">Review note (optional)</span>
            <input
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              className="mt-1 w-full rounded-md border border-paper-line bg-paper px-2.5 py-1.5 text-sm text-ink outline-none focus:border-pool"
            />
          </label>
          {msg && (
            <p className={`mb-2 text-xs ${msg.tone === "ok" ? "text-pool-deep" : "text-blaze-deep"}`}>{msg.text}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run("publish")}
              className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-ink-deep disabled:opacity-50"
            >
              {busy === "publish" ? "Publishing…" : `Publish ${acceptCount} fact(s)`}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run("needs_info")}
              className="rounded-md border border-paper-line px-3 py-2 text-sm text-ink transition-colors hover:border-pool/40 disabled:opacity-50"
            >
              Request info
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run("reject")}
              className="rounded-md border border-paper-line px-3 py-2 text-sm text-blaze-deep transition-colors hover:border-blaze/40 disabled:opacity-50"
            >
              Reject all
            </button>
          </div>
          <p className="mt-2 text-xs text-mist">
            Accepted facts publish at the <span className="font-medium text-pool-deep">owner</span> tier and set the
            Owner-Listed badge. Conflicts (highlighted) overwrite existing values — review them first.
          </p>
        </div>
      )}
      {!actionable && msg && (
        <p className={`mt-3 text-xs ${msg.tone === "ok" ? "text-pool-deep" : "text-blaze-deep"}`}>{msg.text}</p>
      )}
    </div>
  );
}

/** Thumbnail strip for an owner-submitted photos fact. */
function PhotoStrip({ value }: { value: unknown }) {
  const photos = Array.isArray(value) ? (value as { url: string; tag?: string | null }[]) : [];
  if (photos.length === 0) return <span className="text-mist">No photos</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {photos.map((p, i) => (
        <a
          key={i}
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          title={p.tag ?? "photo"}
          className="block h-14 w-14 overflow-hidden rounded-md border border-paper-line"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.url} alt={p.tag ?? "Owner photo"} className="h-full w-full object-cover" />
        </a>
      ))}
    </div>
  );
}
