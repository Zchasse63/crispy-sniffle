import { SignalPin } from "@/components/brand/SignalPin";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-contour bg-paper-raise px-6 py-16 text-center">
      <span className="text-contour opacity-80">
        <SignalPin size={64} variant="utility" />
      </span>
      <h3 className="display mt-5 text-xl text-ink">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink/70">{description}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="display mt-6 rounded-md bg-blaze px-5 py-2.5 text-sm tracking-wide text-white transition-colors hover:bg-blaze-deep"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
