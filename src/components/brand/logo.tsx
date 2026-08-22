import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The Ahd seal.
 *
 * The mark is a circular seal — the open mushaf beneath a crescent and sun,
 * ringed in girih geometry, carrying AHD and عهد. It is generated from
 * `brand/ahd-source.png` by `npm run brand:build`, cropped to the seal and
 * masked to a circle so the corners are transparent and it sits correctly on
 * the dark ground.
 *
 * Rendered at a real pixel size rather than a CSS class, so the right file is
 * chosen for the job: a 36px header icon should not download the 1024px master.
 */

const AVAILABLE = [64, 128, 256, 512, 1024] as const;

/** Smallest asset that still covers a 2× display at this size. */
function sourceFor(size: number) {
  return AVAILABLE.find((candidate) => candidate >= size * 2) ?? 1024;
}

export function AhdMark({
  size = 32,
  className,
  priority,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={`/brand/mark-${sourceFor(size)}.png`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      priority={priority}
      /* The seal is cream-on-transparent. On ink it glows on its own; on
         parchment it needs a whisper of a shadow or its edge disappears into
         the page. Invisible on dark, so it can simply always be on. */
      className={cn(
        "shrink-0 select-none [filter:drop-shadow(0_1px_2px_rgb(0_0_0/0.10))]",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}

export function Wordmark({
  className,
  size = 34,
  showArabic = false,
  priority,
}: {
  className?: string;
  size?: number;
  /** The seal already carries عهد; only set this where it is wanted twice. */
  showArabic?: boolean;
  priority?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <AhdMark size={size} priority={priority} />
      <span className="flex items-baseline gap-2">
        <span className="font-[family-name:var(--font-display)] text-[1.375rem] leading-none font-semibold tracking-[0.02em] text-[var(--text-strong)]">
          Ahd
        </span>
        {showArabic && (
          <span
            aria-hidden
            className="font-arabic text-[0.9375rem] leading-none text-[var(--text-faint)]"
          >
            عهد
          </span>
        )}
      </span>
    </span>
  );
}
