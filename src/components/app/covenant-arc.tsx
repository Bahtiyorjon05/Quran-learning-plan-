import type { Pace, PaceBand } from "@/core/plan/pace";
import { CountUp } from "@/components/ui/count-up";
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
 *
 * The dial around it is borrowed from an astrolabe, which is the right
 * reference twice over: it is the instrument this civilisation used to know
 * when to pray, and a bare ring gives the eye no way to judge how far round
 * the fill has come. Sixteen marks, every fourth one longer.
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

const TICKS = 16;

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

  /* The label is a formatted percentage; counting it up needs the number, and
     anything that is not one (a dash, an em-dash) is simply printed. */
  const numeric = Number(label.replace("%", ""));
  const countable = Number.isFinite(numeric) && label.endsWith("%");
  const decimals = label.includes(".") ? 1 : 0;

  return (
    <div className="relative grid shrink-0 place-items-center">
      {/* The halo. Sits behind everything, takes the band's colour, and is the
          reason the ring reads as lit rather than printed. */}
      <div
        aria-hidden
        className="ahd-arc-halo pointer-events-none absolute h-32 w-32 rounded-full blur-2xl sm:h-36 sm:w-36"
        style={{ background: `radial-gradient(circle, ${color}, transparent 68%)`, opacity: 0.4 }}
      />

      <svg viewBox="0 0 128 128" className="relative h-36 w-36 -rotate-[225deg] sm:h-40 sm:w-40">
        <defs>
          <linearGradient id="ahd-arc-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* The dial. */}
        <g stroke="var(--line-strong)" strokeWidth="1" strokeLinecap="round">
          {Array.from({ length: TICKS + 1 }, (_, i) => {
            const angle = (i / TICKS) * SWEEP * 2 * Math.PI;
            const major = i % 4 === 0;
            const inner = major ? 40 : 43;
            const outer = 46;
            return (
              <line
                key={i}
                x1={64 + Math.cos(angle) * inner}
                y1={64 + Math.sin(angle) * inner}
                x2={64 + Math.cos(angle) * outer}
                y2={64 + Math.sin(angle) * outer}
                opacity={major ? 0.9 : 0.45}
              />
            );
          })}
        </g>

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

        {/* What is kept of it, drawn on arrival. */}
        <circle
          cx="64"
          cy="64"
          r={RADIUS}
          fill="none"
          stroke="url(#ahd-arc-fill)"
          strokeWidth="7"
          strokeLinecap="round"
          className="ahd-arc-value"
          style={
            {
              "--arc-to": `${ARC * progress}`,
              "--arc-circumference": `${CIRCUMFERENCE}`,
            } as React.CSSProperties
          }
        />
      </svg>

      <div className="absolute inset-0 grid place-content-center text-center">
        <p
          className="font-[family-name:var(--font-display)] text-[2.5rem] leading-none font-light tabular-nums sm:text-[2.75rem]"
          style={{ color }}
        >
          {countable ? (
            <>
              <CountUp value={numeric} decimals={decimals} />%
            </>
          ) : (
            label
          )}
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
 * so the arc stays the thing the eye lands on first. The hairline above each
 * one is the only structure they get, and it is what turns four loose figures
 * into a row that reads as a set.
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
  /* Counted up when it is a plain number. Values carrying a sign ("+3") keep
     the sign and count the magnitude, because the sign is the meaning. */
  const sign = value.startsWith("+") || value.startsWith("-") ? value[0] : "";
  const numeric = Number(sign ? value.slice(1) : value);
  const countable = Number.isFinite(numeric);

  return (
    <div className="border-t border-[var(--line-subtle)] pt-3">
      <p
        className={cn(
          "font-[family-name:var(--font-display)] text-[1.625rem] leading-none font-light tabular-nums",
          tone === "plain" && "text-[var(--text-strong)]",
          tone === "warn" && "text-gold-ink",
          tone === "good" && "text-[var(--accent-strong)]",
        )}
      >
        {countable ? (
          <>
            {sign}
            <CountUp value={numeric} />
          </>
        ) : (
          value
        )}
      </p>
      <p className="mt-1.5 text-[0.6875rem] leading-tight tracking-[0.1em] text-[var(--text-faint)] uppercase">
        {label}
      </p>
    </div>
  );
}
