import type { ReactElement } from "react";
import type { GymSegment } from "@/lib/types/scout";

/**
 * Per-segment placeholder scenes — every facility type gets its own visual
 * identity instead of one repeated watermark. Minimal paper-tone line work
 * over the card's segment gradient; designed to read at card size.
 */
const P = "#F1ECDF"; // paper line work

function Strength() {
  return (
    <g stroke={P} fill="none" strokeWidth="3" strokeLinecap="round">
      {/* loaded barbell, side-on */}
      <line x1="70" y1="86" x2="330" y2="86" strokeWidth="5" opacity=".5" />
      <g opacity=".55">
        <rect x="96" y="46" width="14" height="80" rx="4" fill={P} stroke="none" />
        <rect x="116" y="58" width="11" height="56" rx="4" fill={P} stroke="none" opacity=".7" />
        <rect x="290" y="46" width="14" height="80" rx="4" fill={P} stroke="none" />
        <rect x="273" y="58" width="11" height="56" rx="4" fill={P} stroke="none" opacity=".7" />
      </g>
      {/* knurl marks */}
      <g opacity=".3">
        <line x1="168" y1="80" x2="168" y2="92" />
        <line x1="200" y1="80" x2="200" y2="92" />
        <line x1="232" y1="80" x2="232" y2="92" />
      </g>
    </g>
  );
}

function Crossfit() {
  return (
    <g stroke={P} fill="none" strokeWidth="3" strokeLinecap="round">
      {/* rig uprights + crossbar */}
      <g opacity=".5">
        <line x1="120" y1="28" x2="120" y2="132" strokeWidth="5" />
        <line x1="280" y1="28" x2="280" y2="132" strokeWidth="5" />
        <line x1="104" y1="34" x2="296" y2="34" strokeWidth="5" />
      </g>
      {/* hanging rings */}
      <g opacity=".55">
        <line x1="200" y1="34" x2="200" y2="64" strokeWidth="2.5" />
        <circle cx="200" cy="76" r="12" />
      </g>
      {/* kettlebell */}
      <g opacity=".55">
        <path d="M160 118 a 13 13 0 1 0 26 0 a 13 13 0 1 0 -26 0" fill={P} stroke="none" />
        <path d="M165 110 q 8 -14 16 0" strokeWidth="4" />
      </g>
    </g>
  );
}

function BigBox() {
  return (
    <g opacity=".5">
      {/* rows of racked dumbbells */}
      {[58, 88, 118].map((y) => (
        <g key={y} stroke={P} strokeWidth="3" strokeLinecap="round">
          <line x1="92" y1={y} x2="308" y2={y} opacity=".45" />
          {[120, 172, 224, 276].map((x) => (
            <g key={x}>
              <line x1={x - 10} y1={y - 9} x2={x + 10} y2={y - 9} strokeWidth="2.5" />
              <rect x={x - 14} y={y - 14} width="5" height="10" rx="2" fill={P} stroke="none" />
              <rect x={x + 9} y={y - 14} width="5" height="10" rx="2" fill={P} stroke="none" />
            </g>
          ))}
        </g>
      ))}
    </g>
  );
}

function Boutique() {
  return (
    <g stroke={P} fill="none" strokeWidth="3" strokeLinecap="round">
      {/* spotlight */}
      <circle cx="200" cy="78" r="44" opacity=".5" />
      <circle cx="200" cy="78" r="6" fill={P} stroke="none" opacity=".6" />
      {/* class formation dots */}
      <g fill={P} stroke="none" opacity=".45">
        {[[120, 124], [160, 132], [200, 136], [240, 132], [280, 124]].map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r="5" />
        ))}
      </g>
    </g>
  );
}

function Climbing() {
  return (
    <g>
      {/* leaning wall */}
      <path d="M120 140 L 230 20 L 300 20" stroke={P} strokeWidth="4" fill="none" opacity=".5" strokeLinecap="round" />
      {/* holds */}
      <g fill={P} stroke="none" opacity=".55">
        <circle cx="156" cy="112" r="6" />
        <circle cx="178" cy="84" r="5" />
        <circle cx="204" cy="60" r="6" />
        <circle cx="224" cy="38" r="5" />
        <circle cx="252" cy="28" r="4" />
        <circle cx="140" cy="132" r="4" />
      </g>
    </g>
  );
}

function YogaPilates() {
  return (
    <g stroke={P} fill="none" strokeWidth="3" strokeLinecap="round">
      {/* sun arc */}
      <path d="M140 70 a 60 60 0 0 1 120 0" opacity=".5" />
      <g opacity=".3">
        <line x1="200" y1="22" x2="200" y2="34" />
        <line x1="156" y1="36" x2="164" y2="46" />
        <line x1="244" y1="36" x2="236" y2="46" />
      </g>
      {/* mat */}
      <rect x="128" y="96" width="144" height="14" rx="7" opacity=".55" />
      {/* breath lines */}
      <g opacity=".3">
        <path d="M130 128 q 18 -8 36 0 t 36 0 t 36 0 t 36 0" />
      </g>
    </g>
  );
}

function Mma() {
  return (
    <g stroke={P} fill="none" strokeWidth="3" strokeLinecap="round">
      {/* ring corner posts + ropes */}
      <g opacity=".5">
        <line x1="110" y1="36" x2="110" y2="132" strokeWidth="5" />
        <line x1="290" y1="36" x2="290" y2="132" strokeWidth="5" />
        <line x1="110" y1="56" x2="290" y2="56" />
        <line x1="110" y1="84" x2="290" y2="84" />
        <line x1="110" y1="112" x2="290" y2="112" />
      </g>
      {/* heavy bag */}
      <g opacity=".55">
        <line x1="200" y1="36" x2="200" y2="52" strokeWidth="2.5" />
        <rect x="184" y="52" width="32" height="52" rx="14" fill={P} stroke="none" opacity=".6" />
      </g>
    </g>
  );
}

function Recovery() {
  return (
    <g stroke={P} fill="none" strokeWidth="3" strokeLinecap="round">
      {/* plunge pool */}
      <ellipse cx="200" cy="112" rx="84" ry="18" opacity=".5" />
      <path d="M132 112 q 22 10 44 0 t 44 0 t 44 0" opacity=".35" />
      {/* rising steam */}
      <g opacity=".5">
        <path d="M168 84 q -8 -12 0 -24 q 8 -12 0 -24" />
        <path d="M200 88 q -8 -12 0 -24 q 8 -12 0 -24" />
        <path d="M232 84 q -8 -12 0 -24 q 8 -12 0 -24" />
      </g>
    </g>
  );
}

function Luxury(): ReactElement {
  return (
    <g stroke={P} fill="none" strokeWidth="3" strokeLinecap="round">
      {/* portico */}
      <path d="M150 116 V72 M186 116 V72 M222 116 V72 M258 116 V72" opacity=".6" />
      <path d="M138 72 H270" />
      <path d="M132 62 L204 40 L276 62 Z" opacity=".7" />
      <path d="M142 116 H266" />
      {/* entry steps */}
      <path d="M168 122 h72 M160 128 h88" opacity=".45" />
      {/* fountain */}
      <ellipse cx="316" cy="112" rx="26" ry="7" opacity=".5" />
      <path d="M306 110 v-14 q 10 -10 20 0 v14 M316 88 v-10" opacity=".6" />
      {/* palm */}
      <path d="M84 118 q 6 -38 -2 -56 M82 62 q -16 -10 -30 -2 M82 62 q 0 -18 -10 -26 M82 62 q 16 -10 30 -4 M82 62 q 12 -16 26 -16" opacity=".7" />
    </g>
  );
}

const SCENES: Record<GymSegment, () => ReactElement> = {
  strength: Strength,
  crossfit: Crossfit,
  big_box: BigBox,
  boutique: Boutique,
  climbing: Climbing,
  yoga_pilates: YogaPilates,
  mma: Mma,
  recovery: Recovery,
  luxury: Luxury,
};

export function SegmentScene({
  segment,
  className,
}: {
  segment: GymSegment | null;
  className?: string;
}) {
  const Scene = segment ? SCENES[segment] : Boutique;
  return (
    <svg
      viewBox="0 0 400 160"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={className ?? "h-full w-full"}
    >
      <Scene />
    </svg>
  );
}
