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

function bit(i: number, count: number) {
  /* A mixed hash rather than `i * k % m`: the cheap version correlates the
     horizontal position with the delay, and sixty motes sharing a correlation
     fall as one diagonal streak across the screen instead of as weather. */
  const r = (salt: number) => {
    let h = Math.imul(i + 1, 374761393) ^ Math.imul(salt + 1, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  /* One column each, then jittered inside it, so the sky is covered evenly
     without the ranks lining up. */
  const lane = (i / count) * 100;
  return {
    x: `${(lane + r(1) * (100 / count)).toFixed(2)}%`,
    /* Only used when motion is reduced and nothing falls. */
    y: `${(6 + r(8) * 82).toFixed(1)}%`,
    w: `${(7 + r(2) * 15).toFixed(1)}px`,
    d: `${(2.6 + r(3) * 2.8).toFixed(2)}s`,
    delay: `${(r(4) * 2.4).toFixed(2)}s`,
    drift: `${Math.round(r(5) * 140 - 70)}px`,
    spin: `${Math.round(r(6) * 560 - 200)}deg`,
    dim: (0.55 + r(7) * 0.45).toFixed(2),
    /* One in three is the star; the rest are points of light. A sky of stars
       would be a pattern, and a pattern is a texture, not a surprise. */
    star: i % 3 === 0,
  };
}

export function Goldfall({ count = 40, className }: { count?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("ahd-fall", className)}>
      <span className="ahd-wash" />
      {Array.from({ length: count }, (_, i) => {
        const b = bit(i, count);
        return (
          <i
            key={i}
            className={b.star ? "ahd-star" : "ahd-mote"}
            style={
              {
                "--x": b.x,
                "--y": b.y,
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
