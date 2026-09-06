import { Khatim } from "@/components/ui/illumination";
import { cn } from "@/lib/utils";

/**
 * The whole Qur'an as thirty seals.
 *
 * The mosaic answers "how much", tile by tile, and it answers it honestly —
 * but six hundred and four tiles is a texture rather than a number, and nobody
 * counts their hifz in pages. They count in juz. Thirty marks is a quantity a
 * person can hold in their head, and the gap between eleven lit and twelve is
 * something you can *want*.
 *
 * Drawn with the same eight-pointed star that frames the covenant card and the
 * sign-in page, because a reward invented for the occasion would be a sticker.
 * This one is already the mark of the book.
 */
export function JuzSeals({
  held,
  className,
}: {
  held: readonly number[];
  className?: string;
}) {
  const lit = new Set(held);

  return (
    <ul
      className={cn("grid grid-cols-10 gap-2 sm:gap-2.5", className)}
      aria-label={`${held.length}/30`}
    >
      {Array.from({ length: 30 }, (_, i) => i + 1).map((juz, i) => {
        const on = lit.has(juz);
        return (
          <li
            key={juz}
            className="ahd-seal-in relative"
            /* One after another, in reading order. Thirty landing at once is a
               flicker; thirty landing in sequence is the book being counted. */
            style={{ animationDelay: `${i * 28}ms` }}
          >
            <span
              title={String(juz)}
              className={cn(
                "group relative grid aspect-square place-items-center rounded-xl border transition-[border-color,background-color] duration-500",
                /* A lit seal has to read on cream as well as on night. The
                   halo does almost nothing against a light ground, so the
                   difference is carried by the fill, the border and the weight
                   of the star itself rather than by glow alone. */
                on
                  ? "border-[var(--gold)]/60 bg-[color-mix(in_oklab,var(--gold)_18%,transparent)] shadow-[inset_0_1px_0_color-mix(in_oklab,var(--gold)_30%,transparent)]"
                  : "border-[var(--line-subtle)] bg-[var(--surface-inset)]/40",
              )}
            >
              {/* The glow lives behind the star, not on it: a lit seal should
                  look like something burning through the page rather than an
                  icon someone turned the opacity up on. */}
              {on && (
                <span
                  aria-hidden
                  className="ahd-seal-glow pointer-events-none absolute inset-0 rounded-xl"
                />
              )}
              <Khatim
                className={cn(
                  "relative h-[58%] w-[58%] transition-colors duration-500",
                  on
                    ? "text-[var(--gold)] [stroke-width:1.5]"
                    : "text-[var(--line-strong)]",
                )}
              />
              <span
                className={cn(
                  "absolute bottom-0.5 text-[0.5rem] leading-none tabular-nums transition-colors duration-500",
                  on ? "text-[var(--gold-ink)]" : "text-[var(--text-faint)]",
                )}
              >
                {juz}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
