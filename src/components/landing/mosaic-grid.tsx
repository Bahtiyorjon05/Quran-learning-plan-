"use client";

import { useEffect, useRef, useState } from "react";
import { useSupports } from "@/lib/client-store";
import { cn } from "@/lib/utils";

export const TOTAL_PAGES = 604;

/* A tiny seeded PRNG so the demo mosaic is byte-identical on the server and in
   the browser. Math.random() here would hydrate-mismatch every single tile. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A plausible hifz in progress: juz 30 and juz 1 solid (how almost everyone
 * starts), a strong middle, and a fraying edge where revision has not caught
 * up yet. Strength is 0–100; 0 means the page has not been started.
 */
function demoStrengths(memorizedPages: number): number[] {
  const rand = mulberry32(1445);
  const out = new Array<number>(TOTAL_PAGES).fill(0);

  const order: number[] = [];
  for (let p = 582; p <= 604; p++) order.push(p); // juz 30 first
  for (let p = 1; p <= 581; p++) order.push(p); // then from the beginning

  for (let i = 0; i < memorizedPages && i < order.length; i++) {
    const page = order[i];
    // The further back in the queue, the more time has passed without revision.
    const age = i / memorizedPages;
    const base = 92 - age * 48;
    const jitter = (rand() - 0.5) * 34;
    out[page - 1] = Math.max(8, Math.min(100, Math.round(base + jitter)));
  }
  return out;
}

export type Band = "none" | "learning" | "weak" | "strong";

export function bandOf(strength: number): Band {
  if (strength <= 0) return "none";
  if (strength < 42) return "learning";
  if (strength < 76) return "weak";
  return "strong";
}

/* Tokens, not fixed shades: on ink "strong" is the brightest tile, on parchment
   it is the deepest. Either way the eye reads strength as presence. */
const BAND_CLASS: Record<Band, string> = {
  none: "bg-band-none",
  learning: "bg-band-learning",
  weak: "bg-band-weak",
  strong: "bg-band-strong shadow-[0_0_10px_-2px_var(--halo)]",
};

export function MosaicLegend({
  labels,
  className,
}: {
  labels: Record<Band, string>;
  className?: string;
}) {
  const order: Band[] = ["none", "learning", "weak", "strong"];
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-6 gap-y-3", className)}>
      {order.map((b) => (
        <li key={b} className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span className={cn("h-3 w-3 rounded-[3px]", BAND_CLASS[b])} aria-hidden />
          {labels[b]}
        </li>
      ))}
    </ul>
  );
}

export function MosaicGrid({
  memorizedPages = 214,
  strengths: given,
  interactive = false,
  className,
  tileClassName,
  onHoverPage,
  onSelectPage,
}: {
  memorizedPages?: number;
  /** Real strengths, 604 entries, 0 meaning not started. The landing page has
   *  none and falls back to the seeded demo. */
  strengths?: number[];
  interactive?: boolean;
  className?: string;
  tileClassName?: string;
  onHoverPage?: (page: number | null) => void;
  /** Given, each tile becomes a button that opens its page. */
  onSelectPage?: (page: number) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  /* Where the observer does not exist there is no reveal to stage, so the tiles
     are simply shown. Derived rather than set from inside the effect, which
     would render once blank and once again populated. */
  const canObserve = useSupports("IntersectionObserver");
  const shown = revealed || !canObserve;
  const ref = useRef<HTMLDivElement>(null);
  const strengths = given ?? demoStrengths(memorizedPages);

  useEffect(() => {
    const el = ref.current;
    if (!el || !canObserve) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [canObserve]);

  return (
    <div
      ref={ref}
      className={cn(
        "grid gap-[2px] sm:gap-[3px]",
        "grid-cols-[repeat(28,minmax(0,1fr))] sm:grid-cols-[repeat(38,minmax(0,1fr))]",
        className,
      )}
      onMouseLeave={() => onHoverPage?.(null)}
    >
      {strengths.map((s, i) => {
        const page = i + 1;
        const band = bandOf(s);
        const Tile = onSelectPage ? "button" : "div";
        return (
          <Tile
            key={page}
            type={onSelectPage ? "button" : undefined}
            data-page={page}
            title={interactive ? `${page}` : undefined}
            aria-label={onSelectPage ? String(page) : undefined}
            onClick={onSelectPage ? () => onSelectPage(page) : undefined}
            onFocus={interactive ? () => onHoverPage?.(page) : undefined}
            onMouseEnter={interactive ? () => onHoverPage?.(page) : undefined}
            style={{
              transitionDelay: shown ? `${(i % 160) * 5}ms` : "0ms",
            }}
            className={cn(
              "aspect-square rounded-[2px] transition-[opacity,transform,background-color] duration-700 ease-[var(--ease-settle)]",
              BAND_CLASS[band],
              shown ? "scale-100 opacity-100" : "scale-75 opacity-0",
              interactive &&
                "hover:!scale-[1.55] hover:!opacity-100 hover:ring-1 hover:ring-gold-300 hover:transition-none",
              onSelectPage && "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
              tileClassName,
            )}
          />
        );
      })}
    </div>
  );
}
