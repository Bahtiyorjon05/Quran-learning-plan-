import { cn } from "@/lib/utils";

/**
 * The illuminated frame, and the star that anchors it.
 *
 * Every product of this kind reaches for the same dark card with a soft
 * border, and Ahd was no exception. But this app is a mushaf before it is
 * software, and a mushaf has a visual grammar of its own that predates all of
 * it: a text block held inside a double rule, the rule broken at each corner by
 * an eight-pointed star, and the whole thing set in from the edge of the page
 * so the frame is clearly a frame and not a boundary.
 *
 * That grammar is the signature here. It costs two hairlines and four small
 * stars, it is drawn entirely in tokens so it belongs to both themes, and it
 * says what no amount of border-radius can: this page is a page of something.
 *
 * {@link Corners} is the quiet version of the same idea, for panels that carry
 * data rather than meaning. This one is for the four or five places a reader
 * should feel they have arrived somewhere.
 */

/**
 * The khatim — an eight-pointed star, drawn as two squares at 45° to each
 * other, which is how it is actually constructed on the page and in tile.
 */
export function Khatim({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
    >
      <rect x="4.5" y="4.5" width="15" height="15" rx="0.75" />
      <rect x="4.5" y="4.5" width="15" height="15" rx="0.75" transform="rotate(45 12 12)" />
    </svg>
  );
}

/**
 * A double rule inset from the panel's edge, with a star let into each corner.
 *
 * Absolutely positioned and inert, so it can be dropped into any `relative`
 * panel without touching that panel's layout. The stars sit *on* the rule
 * rather than beside it — they are what interrupts it — which is why each one
 * carries the panel's own background behind it.
 */
export function Illuminated({
  className,
  inset = "1rem",
  tone = "gold",
}: {
  className?: string;
  /** How far the frame sits in from the panel edge. */
  inset?: string;
  tone?: "gold" | "accent";
}) {
  const line =
    tone === "gold"
      ? "color-mix(in oklab, var(--gold) 38%, transparent)"
      : "color-mix(in oklab, var(--accent) 34%, transparent)";
  const faint =
    tone === "gold"
      ? "color-mix(in oklab, var(--gold) 16%, transparent)"
      : "color-mix(in oklab, var(--accent) 14%, transparent)";
  const star = tone === "gold" ? "text-[var(--gold)]" : "text-[var(--accent)]";

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
    >
      {/* The outer rule, and a second hairline just inside it. Two lines a
          hair apart is the whole difference between a border and a frame. */}
      <span
        className="absolute rounded-[1.25rem]"
        style={{ inset, border: `1px solid ${line}` }}
      />
      <span
        className="absolute rounded-[1.1rem]"
        style={{ inset: `calc(${inset} + 4px)`, border: `1px solid ${faint}` }}
      />

      {/* Four stars, let into the rule. They arrive after the panel so it
          lands first and is then illuminated. */}
      {(
        [
          ["top", "left"],
          ["top", "right"],
          ["bottom", "left"],
          ["bottom", "right"],
        ] as const
      ).map(([y, x], i) => (
        <span
          key={`${y}${x}`}
          className={cn(
            "absolute grid h-5 w-5 place-items-center rounded-full bg-[var(--surface-raised)]",
            /* Visible by default; the animation only handles the arrival.
               Hiding them with opacity-0 and relying on a keyframe to bring
               them back means they never appear at all wherever animation is
               suppressed — which is a whole class of browser and setting. */
            "[animation:ahd-corner-in_1s_var(--ease-settle)_both]",
            star,
          )}
          style={{
            [y]: `calc(${inset} - 0.625rem)`,
            [x]: `calc(${inset} - 0.625rem)`,
            animationDelay: `${0.35 + i * 0.1}s`,
          }}
        >
          <Khatim className="h-4 w-4" />
        </span>
      ))}
    </div>
  );
}

/**
 * A section break: a hairline that fades in from nothing, a star, and a
 * hairline that fades back out. Used where a page changes subject.
 */
export function StarRule({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex items-center gap-4", className)}>
      <span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--gold)_35%,transparent))]" />
      <Khatim className="h-4 w-4 shrink-0 text-[var(--gold)] opacity-70" />
      <span className="h-px flex-1 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--gold)_35%,transparent),transparent)]" />
    </div>
  );
}
