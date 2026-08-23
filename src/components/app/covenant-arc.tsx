import type { Pace, PaceBand } from "@/core/plan/pace";
import { cn } from "@/lib/utils";

/**
 * The covenant as a single shape.
 *
 * A progress bar answers "how far along am I". This has to answer a harder
 * question — am I keeping the promise — and those are not the same. Someone
 * 40% through can be comfortably ahead or badly behind depending on the time
 * left, so the arc carries both: the fill is progress, and the colour is
 * whether the pace still holds.
 *
 * Drawn as an open arc rather than a full ring because a ring reads as a
 * countdown to something finished, and hifz is not that. The gap at the bottom
 * is where the numbers sit.
 */

const BAND_COLOR: Record<PaceBand, string> = {
  done: "var(--accent)",
  ahead: "var(--accent)",
  onTrack: "var(--accent)",
  tightening: "var(--color-gold-500)",
  atRisk: "var(--color-danger)",
};

/* 270° of a circle, opening downward. */
const SWEEP = 0.75;
const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC = CIRCUMFERENCE * SWEEP;

export function CovenantArc({
  pace,
  label,
  caption,
}: {
  pace: Pace;
  /** The big number in the middle. */
  label: string;
  caption: string;
}) {
  const progress = Math.max(0, Math.min(1, pace.progress));
  const color = BAND_COLOR[pace.band];

  return (
    <div className="relative grid place-items-center">
      <svg viewBox="0 0 128 128" className="h-36 w-36 -rotate-[225deg] sm:h-40 sm:w-40">
        {/* The track: the whole promise. */}
        <circle
          cx="64"
          cy="64"
          r={RADIUS}
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${ARC} ${CIRCUMFERENCE}`}
        />
        {/* What is kept of it. */}
        <circle
          cx="64"
          cy="64"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${ARC * progress} ${CIRCUMFERENCE}`}
          className="transition-[stroke-dasharray] duration-1000 ease-[var(--ease-calm)]"
        />
      </svg>

      <div className="absolute inset-0 grid place-content-center text-center">
        <p
          className="font-[family-name:var(--font-display)] text-[2.5rem] leading-none font-light tabular-nums sm:text-[2.75rem]"
          style={{ color }}
        >
          {label}
        </p>
        <p className="mt-1.5 text-[0.6875rem] tracking-[0.12em] text-[var(--text-faint)] uppercase">
          {caption}
        </p>
      </div>
    </div>
  );
}

/**
 * One number and what it means.
 *
 * Four of these sit beside the arc. Deliberately flat — no borders, no cards —
 * so the arc stays the thing the eye lands on first.
 */
export function Stat({
  value,
  label,
  tone = "plain",
}: {
  value: string;
  label: string;
  tone?: "plain" | "warn" | "good";
}) {
  return (
    <div>
      <p
        className={cn(
          "font-[family-name:var(--font-display)] text-[1.5rem] leading-none font-light tabular-nums",
          tone === "plain" && "text-[var(--text-strong)]",
          tone === "warn" && "text-gold-ink",
          tone === "good" && "text-[var(--accent-strong)]",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[0.6875rem] leading-tight tracking-[0.1em] text-[var(--text-faint)] uppercase">
        {label}
      </p>
    </div>
  );
}
