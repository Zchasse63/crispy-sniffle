/** Deterministic match score pill. Tooltip lists why + what's missing. */
export function MatchBadge({
  score,
  reasons,
  missingItems,
  size = "md",
}: {
  score: number;
  reasons: string[];
  missingItems: string[];
  size?: "sm" | "md";
}) {
  const tone =
    score >= 80
      ? "bg-blaze text-white"
      : score >= 60
        ? "bg-pool text-white"
        : "bg-contour text-ink";
  const tooltip = [
    ...reasons.map((r) => `✓ ${r}`),
    ...missingItems.map((m) => `– ${m}`),
  ].join("\n");
  return (
    <span
      title={tooltip || undefined}
      className={`font-mono inline-flex items-center gap-1 rounded ${tone} ${
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]"
      } font-semibold uppercase tracking-wider`}
    >
      {score} match
    </span>
  );
}
