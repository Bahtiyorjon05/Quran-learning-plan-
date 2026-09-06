import { cn } from "@/lib/utils";

/**
 * Gold, falling across the screen.
 *
 * Used for the moments that deserve more than a line of text: a juz finished,
 * and every larger thing after it. The density is the only dial — one juz gets
 * a scattering, the whole Qur'an gets a downpour — because escalating by
 * adding *kinds* of decoration is how a celebration turns into a carnival.
 *
 * The randomness is a hash of the index rather than `Math.random`, so the
 * server and the browser lay the same shower down and hydration has nothing to
 * argue about.
 */

function bit(i: number) {
  const r = (salt: number) => (((i + 1) * 9301 + salt * 49297) % 233280) / 233280;
  return {
    /* Spread across the width, then nudged, so the columns never line up. */
    x: `${(r(1) * 100).toFixed(2)}%`,
    w: `${(4 + r(2) * 9).toFixed(1)}px`,
    d: `${(3.6 + r(3) * 3.4).toFixed(2)}s`,
    delay: `${(r(4) * 3.2).toFixed(2)}s`,
    drift: `${Math.round(r(5) * 140 - 70)}px`,
    spin: `${Math.round(r(6) * 560 - 200)}deg`,
    dim: (0.32 + r(7) * 0.5).toFixed(2),
    /* One in three is the star; the rest are points of light. A sky of stars
       would be a pattern, and a pattern is a texture, not a surprise. */
    star: i % 3 === 0,
  };
}

export function Goldfall({ count = 40, className }: { count?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("ahd-fall", className)}>
      {Array.from({ length: count }, (_, i) => {
        const b = bit(i);
        return (
          <i
            key={i}
            className={b.star ? "ahd-star" : "ahd-mote"}
            style={
              {
                "--x": b.x,
                "--w": b.w,
                "--d": b.d,
                "--delay": b.delay,
                "--drift": b.drift,
                "--spin": b.spin,
                "--dim": b.dim,
              } as React.CSSProperties
            }
          >
            {b.star && (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
                className="h-full w-full"
              >
                <rect x="4.5" y="4.5" width="15" height="15" rx="1" />
                <rect x="4.5" y="4.5" width="15" height="15" rx="1" transform="rotate(45 12 12)" />
              </svg>
            )}
          </i>
        );
      })}
    </div>
  );
}
