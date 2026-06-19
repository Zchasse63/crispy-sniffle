import { Panel } from "@/components/admin/ui";

/** Shared placeholder for sections deliberately sequenced for later
 *  (analytics + monetization), per the admin-portal-spec decision. */
export function DeferredPanel({
  reason,
  gate,
}: {
  reason: string;
  gate: string;
}) {
  return (
    <Panel className="p-6">
      <p className="readout mb-2 inline-block rounded-full border border-paper-line px-2 py-0.5 text-[10px] uppercase tracking-widest text-mist">
        Deferred by design
      </p>
      <p className="text-sm text-ink">{reason}</p>
      <p className="mt-2 text-xs text-mist">
        <span className="font-medium text-ink">Gate:</span> {gate}
      </p>
    </Panel>
  );
}
