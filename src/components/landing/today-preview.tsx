import { useTranslations } from "next-intl";
import { Check, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

function Ring({ value, done }: { value: number; done?: boolean }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-10 w-10 shrink-0 place-items-center">
      <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          strokeWidth="2.5"
          className="stroke-[color-mix(in_oklab,var(--text-strong)_10%,transparent)]"
        />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          className={done ? "stroke-emerald-400" : "stroke-gold-400"}
        />
      </svg>
      <span className="absolute grid place-items-center">
        {done ? (
          <Check className="h-4 w-4 text-emerald-400" />
        ) : (
          <span className="text-[0.625rem] font-semibold text-gold-300 tabular-nums">
            {value}
          </span>
        )}
      </span>
    </div>
  );
}

/* A fixed, hand-tuned strip — no randomness, so it renders identically on the
   server and never shifts on hydration. */
const STRIP = [
  ...Array(34).fill(3),
  ...Array(9).fill(2),
  3, 3, 2, 3, 3, 3, 2, 2, 3, 3,
  ...Array(7).fill(1),
  ...Array(26).fill(0),
] as const;

const STRIP_CLASS = [
  "bg-[color-mix(in_oklab,var(--text-strong)_7%,transparent)]",
  "bg-emerald-900",
  "bg-emerald-700",
  "bg-emerald-400",
];

export function TodayPreview() {
  const tp = useTranslations("landing.preview");
  const tt = useTranslations("landing.tracks");

  const tracks = [
    {
      ar: "سبق",
      name: tt("sabaq.name"),
      role: tt("roleNew"),
      detail: tp("sabaqDetail"),
      value: 100,
      done: true,
    },
    {
      ar: "سبقي",
      name: tt("sabqi.name"),
      role: tt("roleRecent"),
      detail: tp("sabqiDetail"),
      value: 100,
      done: true,
    },
    {
      ar: "منزل",
      name: tt("manzil.name"),
      role: tt("roleOld"),
      detail: tp("manzilDetail"),
      value: 60,
      done: false,
    },
  ];

  return (
    <div className="relative">
      {/* Depth: a second card peeking out behind the first. */}
      <div
        aria-hidden
        className="absolute inset-x-6 -top-4 h-16 rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-raised)]/40"
      />

      <div className="relative rounded-[1.75rem] bg-[linear-gradient(150deg,color-mix(in_oklab,var(--accent)_28%,transparent),color-mix(in_oklab,var(--color-gold-500)_16%,transparent)_45%,transparent_75%)] p-px shadow-[0_40px_90px_-40px_rgba(0,0,0,0.75)]">
        <div className="rounded-[calc(1.75rem-1px)] border border-[var(--line-subtle)] bg-[var(--surface-base)]/92 p-5 backdrop-blur-xl sm:p-6">
          {/* ── header ── */}
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2.5">
              <h3 className="font-[family-name:var(--font-display)] text-xl font-medium text-[var(--text-strong)]">
                {tp("today")}
              </h3>
              <span className="font-arabic text-sm text-[var(--text-faint)]" aria-hidden>
                اليوم
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/30 bg-gold-500/10 px-2.5 py-1 text-[0.6875rem] font-medium text-gold-300">
              <Flame className="h-3 w-3" />
              {tp("streak", { count: 41 })}
            </span>
          </div>

          {/* ── the three obligations ── */}
          <ul className="mt-5 space-y-2.5">
            {tracks.map((track) => (
              <li
                key={track.name}
                className={cn(
                  "flex items-center gap-3.5 rounded-xl border px-3.5 py-3 transition-colors",
                  track.done
                    ? "border-emerald-500/20 bg-emerald-500/[0.06]"
                    : "border-gold-500/25 bg-gold-500/[0.05]",
                )}
              >
                <Ring value={track.value} done={track.done} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-arabic text-[0.9375rem] leading-none text-gold-300/90" aria-hidden>
                      {track.ar}
                    </span>
                    <span className="text-sm font-medium text-[var(--text-strong)]">
                      {track.name}
                    </span>
                    <span className="ms-auto shrink-0 text-[0.625rem] font-semibold tracking-[0.14em] text-[var(--text-faint)] uppercase">
                      {track.role}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                    {track.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {/* ── pace pressure ── */}
          <div className="mt-5 rounded-xl border border-[var(--line-subtle)] px-3.5 py-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)]">{tp("pace")}</span>
              <span className="font-medium text-emerald-400">{tp("onTrack")}</span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--text-strong)_8%,transparent)]">
              <div className="h-full w-[38%] rounded-full bg-[linear-gradient(90deg,var(--color-emerald-500),var(--color-emerald-300))]" />
            </div>
            <p className="mt-2 text-[0.6875rem] text-[var(--text-faint)]">
              {tp("aheadBy")}
            </p>
          </div>

          {/* ── a sliver of the mosaic ── */}
          <div className="mt-5">
            <div className="grid grid-cols-[repeat(29,minmax(0,1fr))] gap-[3px]">
              {STRIP.map((band, i) => (
                <span
                  key={i}
                  className={cn("aspect-square rounded-[2px]", STRIP_CLASS[band])}
                />
              ))}
            </div>
            <p className="mt-3 text-[0.6875rem] text-[var(--text-faint)]">
              {tp("mosaicCaption")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
