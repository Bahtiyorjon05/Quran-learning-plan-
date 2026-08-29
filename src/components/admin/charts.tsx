"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDot, TrendingUp, Trophy } from "lucide-react";

import type { PaceBand } from "@/core/plan/pace";
import { cn } from "@/lib/utils";

/**
 * The admin charts.
 *
 * Three rules decide everything here, and they are why there is no pie chart
 * and no rainbow:
 *
 *   - Colour encodes a job, not decoration. Magnitude gets one hue, stepped.
 *     Identity — which mode, which ayah — is carried by the label beside the
 *     bar, so those charts are single-hue too and the colour-blindness problem
 *     never arises.
 *   - Status is reserved. The pace bands use the fixed good/warning/critical
 *     palette, and each ships with an icon and a word, so the state is never
 *     colour alone.
 *   - Every chart has a text equivalent. The numbers sit beside the bars rather
 *     than only in a tooltip, so the picture is a convenience and never the
 *     only way to read the data.
 *
 * The emerald ordinal ramp below was validated against both surfaces: monotone
 * lightness, adjacent gaps ≥ 0.06 L, and the step nearest the surface clearing
 * 2:1 contrast in each mode.
 */

/* ── Bars over time ───────────────────────────────────────────────────────── */

export function DailyBars({
  data,
  label,
  emptyLabel,
}: {
  data: { date: string; count: number }[];
  label: string;
  emptyLabel: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const peak = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const active = hovered === null ? null : data[hovered];

  if (total === 0) {
    return (
      <p className="py-10 text-center text-[0.8125rem] text-[var(--text-faint)]">{emptyLabel}</p>
    );
  }

  return (
    <div>
      <div className="flex h-28 items-end gap-[3px]" role="img" aria-label={label}>
        {data.map((day, i) => (
          <button
            key={day.date}
            type="button"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered(null)}
            /* The hit target is the whole column, not the bar: a one-signup day
               is three pixels tall and would be unhoverable otherwise. */
            className="group relative flex h-full flex-1 items-end"
            aria-label={`${day.date}: ${day.count}`}
          >
            <span
              className={cn(
                "w-full rounded-t-[3px] transition-[background-color,opacity] duration-200",
                hovered === i ? "bg-[var(--viz-4)]" : "bg-[var(--viz-2)]",
                hovered !== null && hovered !== i && "opacity-45",
              )}
              style={{ height: `${Math.max(day.count === 0 ? 2 : 8, (day.count / peak) * 100)}%` }}
            />
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3 text-[0.6875rem] text-[var(--text-faint)] tabular-nums">
        <span>{data[0]?.date}</span>
        <span
          className={cn(
            "font-medium transition-colors",
            active ? "text-[var(--text-strong)]" : "text-[var(--text-faint)]",
          )}
        >
          {active ? `${active.date} · ${active.count}` : `${total} total`}
        </span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

/* ── The funnel ───────────────────────────────────────────────────────────── */

/** Validated ordinal steps, darkening as the funnel narrows. */
const FUNNEL_STEP = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)", "var(--viz-4)"];

export function Funnel({
  stages,
  labels,
}: {
  stages: { id: string; count: number; conversion: number | null }[];
  labels: Record<string, string>;
}) {
  const top = Math.max(1, stages[0]?.count ?? 1);

  return (
    <ol className="space-y-2.5">
      {stages.map((stage, i) => {
        const share = stage.count / top;
        /* Steps are reused past the fourth rather than inventing a fifth: the
           ramp is validated at four, and a made-up step would not be. */
        const colour = FUNNEL_STEP[Math.min(i, FUNNEL_STEP.length - 1)];
        const dropped = stage.conversion !== null && stage.conversion < 0.6;

        return (
          <li key={stage.id}>
            <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
              <span className="text-[var(--text-default)]">{labels[stage.id] ?? stage.id}</span>
              <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                {stage.conversion !== null && (
                  <span
                    className={cn(
                      "text-[0.6875rem]",
                      dropped ? "text-[var(--status-warning-ink)]" : "text-[var(--text-faint)]",
                    )}
                  >
                    {Math.round(stage.conversion * 100)}%
                  </span>
                )}
                <span className="font-medium text-[var(--text-strong)]">{stage.count}</span>
              </span>
            </div>

            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--text-strong)_7%,transparent)]">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-[var(--ease-calm)]"
                style={{
                  width: `${Math.max(share > 0 ? 1.5 : 0, share * 100)}%`,
                  backgroundColor: colour,
                }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Ranked bars, one hue ─────────────────────────────────────────────────── */

/**
 * A ranked list where the bar is the magnitude and the label is the identity.
 *
 * Single hue on purpose: giving each row its own colour would imply the colours
 * mean something, and then eight of them would have to survive a colour-vision
 * check for no gain at all.
 */
export function RankedBars({
  rows,
  emptyLabel,
}: {
  rows: { key: string; label: string; value: number; note?: string }[];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-[0.8125rem] text-[var(--text-faint)]">{emptyLabel}</p>
    );
  }

  const peak = Math.max(1, ...rows.map((r) => r.value));

  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
          <span className="truncate text-[0.8125rem] text-[var(--text-default)]">{row.label}</span>
          <span className="shrink-0 text-[0.8125rem] font-medium text-[var(--text-strong)] tabular-nums">
            {row.value}
            {row.note && (
              <span className="ms-2 text-[0.6875rem] font-normal text-[var(--text-faint)]">
                {row.note}
              </span>
            )}
          </span>
          <div className="col-span-2 mt-1 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--text-strong)_7%,transparent)]">
            <div
              className="h-full rounded-full bg-[var(--viz-3)]"
              style={{ width: `${Math.max(2, (row.value / peak) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ── Pace, as reserved status ─────────────────────────────────────────────── */

const BAND_STYLE: Record<
  PaceBand,
  { icon: typeof CheckCircle2; ink: string; dot: string }
> = {
  done: { icon: Trophy, ink: "text-[var(--status-good-ink)]", dot: "bg-[var(--status-good)]" },
  ahead: {
    icon: TrendingUp,
    ink: "text-[var(--status-good-ink)]",
    dot: "bg-[var(--status-good)]",
  },
  onTrack: {
    icon: CheckCircle2,
    ink: "text-[var(--text-muted)]",
    dot: "bg-[var(--text-faint)]",
  },
  tightening: {
    icon: CircleDot,
    ink: "text-[var(--status-warning-ink)]",
    dot: "bg-[var(--status-warning)]",
  },
  atRisk: {
    icon: AlertTriangle,
    ink: "text-[var(--status-critical-ink)]",
    dot: "bg-[var(--status-critical)]",
  },
};

/**
 * How the active covenants are holding.
 *
 * Status colours are reserved and never reused as series colours, and each band
 * carries an icon and its name — so the state survives colour-blindness, a
 * monochrome screen, and forced-colours mode.
 */
export function PaceBands({
  bands,
  labels,
  emptyLabel,
}: {
  bands: { band: PaceBand; count: number }[];
  labels: Record<string, string>;
  emptyLabel: string;
}) {
  const total = bands.reduce((sum, b) => sum + b.count, 0);

  if (total === 0) {
    return (
      <p className="py-8 text-center text-[0.8125rem] text-[var(--text-faint)]">{emptyLabel}</p>
    );
  }

  return (
    <>
      {/* One bar, segmented. Two-pixel gaps between segments so adjacent fills
          never blend into a single block. */}
      <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full" role="presentation">
        {bands
          .filter((b) => b.count > 0)
          .map((b) => (
            <span
              key={b.band}
              className={cn("h-full first:rounded-s-full last:rounded-e-full", BAND_STYLE[b.band].dot)}
              style={{ width: `${(b.count / total) * 100}%` }}
            />
          ))}
      </div>

      <ul className="mt-4 space-y-2">
        {bands.map((b) => {
          const { icon: Icon, ink } = BAND_STYLE[b.band];
          return (
            <li key={b.band} className="flex items-center gap-2.5 text-[0.8125rem]">
              <Icon className={cn("h-3.5 w-3.5 shrink-0", ink)} strokeWidth={1.8} />
              <span className="flex-1 text-[var(--text-default)]">{labels[b.band] ?? b.band}</span>
              <span
                className={cn(
                  "shrink-0 font-medium tabular-nums",
                  b.count > 0 ? "text-[var(--text-strong)]" : "text-[var(--text-faint)]",
                )}
              >
                {b.count}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
