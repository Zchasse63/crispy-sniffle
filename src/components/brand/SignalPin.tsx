/**
 * Signal Pin — Scout's primary mark.
 * A map pin with a dumbbell at its heart and signal arcs radiating outward:
 * "AI scanning the landscape of gyms."
 *
 * variant="full"    → pin + dumbbell + both arc pairs (hero, lockups)
 * variant="utility" → smaller arcs, simplified dumbbell (badges, dense UI)
 */
export function SignalPin({
  size = 56,
  variant = "full",
  className,
}: {
  size?: number;
  variant?: "full" | "utility";
  className?: string;
}) {
  const full = variant === "full";
  return (
    <svg
      width={size}
      height={size * (64 / 88)}
      viewBox="0 0 88 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* signal arcs — left */}
      <path
        d="M16 19a16.5 16.5 0 0 0 0 22"
        stroke="var(--color-pool)"
        strokeWidth={full ? 3.4 : 3}
        strokeLinecap="round"
      />
      {full && (
        <path
          d="M8.5 14.5a24.5 24.5 0 0 0 0 31"
          stroke="var(--color-pool)"
          strokeWidth={2.6}
          strokeLinecap="round"
          opacity={0.55}
        />
      )}
      {/* signal arcs — right */}
      <path
        d="M72 19a16.5 16.5 0 0 1 0 22"
        stroke="var(--color-pool)"
        strokeWidth={full ? 3.4 : 3}
        strokeLinecap="round"
      />
      {full && (
        <path
          d="M79.5 14.5a24.5 24.5 0 0 1 0 31"
          stroke="var(--color-pool)"
          strokeWidth={2.6}
          strokeLinecap="round"
          opacity={0.55}
        />
      )}
      {/* pin body */}
      <path
        d="M44 4.5c-10.8 0-18.5 8-18.5 18.2 0 11.6 12 21.4 18.5 37 6.5-15.6 18.5-25.4 18.5-37C62.5 12.5 54.8 4.5 44 4.5Z"
        stroke="currentColor"
        strokeWidth={4.4}
        strokeLinejoin="round"
        fill="var(--color-paper-raise)"
      />
      {/* dumbbell */}
      <g fill="var(--color-blaze)">
        {/* bar */}
        <rect x="34.5" y="21.4" width="19" height="2.8" rx="1.4" />
        {/* outer plates */}
        <rect x="31.6" y="16.2" width="4.2" height="13.2" rx="1.6" />
        <rect x="52.2" y="16.2" width="4.2" height="13.2" rx="1.6" />
        {/* inner plates */}
        {full && (
          <>
            <rect x="36.6" y="18.4" width="3.2" height="8.8" rx="1.3" />
            <rect x="48.2" y="18.4" width="3.2" height="8.8" rx="1.3" />
          </>
        )}
      </g>
    </svg>
  );
}

/** Wordmark lockup: Signal Pin + SCOUT + optional taglines. */
export function LogoLockup({
  pinSize = 64,
  showTagline = false,
  className,
}: {
  pinSize?: number;
  showTagline?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <span className="text-ink shrink-0">
        <SignalPin size={pinSize} />
      </span>
      <span className="flex flex-col">
        <span
          className="display text-ink leading-none"
          style={{ fontSize: pinSize * 0.62 }}
        >
          Scout
        </span>
        {showTagline && (
          <>
            <span className="readout mt-1 text-blaze">
              AI-powered gym discovery.
            </span>
            <span className="readout mt-0.5 text-pool">Find your fit.</span>
          </>
        )}
      </span>
    </div>
  );
}
