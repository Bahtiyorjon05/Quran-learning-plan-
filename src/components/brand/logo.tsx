import { cn } from "@/lib/utils";

/**
 * The Ahd mark is the rub' al-hizb — ۞ — the eight-pointed star that marks
 * divisions in the mushaf itself: two squares, one turned forty-five degrees,
 * held inside a ring. It already means "a measured portion of the Qur'an",
 * which is exactly what this app hands you every morning. The ring is the
 * covenant closing around it.
 */
export function AhdMark({
  className,
  strokeWidth = 1.4,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("h-8 w-8", className)}
    >
      <defs>
        <linearGradient id="ahd-mark-g" x1="4" y1="2" x2="28" y2="30">
          <stop offset="0%" stopColor="var(--color-gold-300)" />
          <stop offset="55%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--color-emerald-600)" />
        </linearGradient>
      </defs>
      <g
        stroke="url(#ahd-mark-g)"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      >
        <path d="M16 1.6 30.4 16 16 30.4 1.6 16Z" />
        <path d="M5.9 5.9h20.2v20.2H5.9Z" />
        <circle cx="16" cy="16" r="4.6" />
      </g>
      <circle cx="16" cy="16" r="1.5" fill="var(--color-gold-400)" />
    </svg>
  );
}

export function Wordmark({
  className,
  showArabic = true,
}: {
  className?: string;
  showArabic?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <AhdMark className="h-7 w-7 shrink-0" />
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
