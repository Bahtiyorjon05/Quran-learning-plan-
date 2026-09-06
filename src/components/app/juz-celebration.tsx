"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Goldfall } from "@/components/ui/goldfall";
import { Illuminated, Khatim, StarRule } from "@/components/ui/illumination";
import { buttonStyles } from "@/components/ui/button";
import { markJuzSeenAction } from "@/app/[locale]/app/milestone-actions";
import { cn } from "@/lib/utils";

/**
 * The moment a juz is finished — and the moments that are more than that.
 *
 * Deliberately a moment and not a toast. Finishing a juz is the work of weeks
 * or months; a strip that slides over a corner and slides out again four
 * seconds later is an insult to it. The reader has to be able to sit with
 * this, and to close it themselves.
 *
 * Five weights, because these are not the same event:
 *
 *   one    the first juz, and every ordinary one after it
 *   five   a quarter of the way, near enough — the first time it feels real
 *   ten    a third of the book
 *   twenty two thirds, and the point most people can see the end from
 *   thirty the whole Qur'an. Everything the app can do, it does here.
 *
 * The escalation is in the words, the light and the time it takes, not in
 * adding confetti. This is a Qur'an app; the grammar stays the frame, the
 * khatim and gold on the night ground throughout — what changes is how much
 * of it there is, and what is said.
 */

type Tier = "one" | "five" | "ten" | "twenty" | "thirty";

function tierOf(total: number): Tier {
  if (total >= 30) return "thirty";
  if (total >= 20) return "twenty";
  if (total >= 10) return "ten";
  if (total >= 5) return "five";
  return "one";
}

/**
 * How big the moment is. The seal and the panel grow, and so does the shower
 * of gold falling past them — a scattering for one juz, a downpour for the
 * whole Qur'an.
 */
const WEIGHT: Record<Tier, { rays: string; seal: string; panel: string; fall: number }> = {
  one: { rays: "opacity-100", seal: "h-28 w-28", panel: "max-w-lg", fall: 130 },
  five: { rays: "opacity-100", seal: "h-32 w-32", panel: "max-w-lg", fall: 165 },
  ten: { rays: "opacity-100", seal: "h-36 w-36", panel: "max-w-xl", fall: 200 },
  twenty: { rays: "opacity-100", seal: "h-40 w-40", panel: "max-w-xl", fall: 240 },
  thirty: { rays: "opacity-100", seal: "h-44 w-44", panel: "max-w-2xl", fall: 300 },
};

export function JuzCelebration({
  juz,
  total,
  name,
}: {
  juz: number[];
  total: number;
  /** Said back to them at thirty. A certificate with no name on it is a poster. */
  name: string;
}) {
  const t = useTranslations("app.milestone");
  const [open, setOpen] = useState(true);
  const dialog = useRef<HTMLDivElement>(null);

  const tier = tierOf(total);
  const whole = tier === "thirty";
  const weight = WEIGHT[tier];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) dialog.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    /* Recorded as seen on the way out rather than on the way in: a page closed
       before it rendered should still be owed the moment. */
    void markJuzSeenAction(juz).catch(() => {});
  }

  if (!open) return null;

  const first = juz[0];
  const many = juz.length > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={whole ? t("hafizTitle") : t("title", { juz: first })}
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto p-4"
    >
      <button
        type="button"
        aria-label={t("close")}
        onClick={close}
        className={cn(
          "fixed inset-0 cursor-default backdrop-blur-md",
          /* At thirty the ground goes almost black: nothing else on the screen
             should be competing for the eye. */
          whole
            ? "bg-[color-mix(in_oklab,var(--surface-base)_94%,transparent)]"
            : "bg-[color-mix(in_oklab,var(--surface-base)_82%,transparent)]",
        )}
      />

      {/* Falling in front of the darkened ground and behind the panel, so the
          words are never read through moving light. */}
      <Goldfall count={weight.fall} className="z-0" />

      <div
        ref={dialog}
        tabIndex={-1}
        className={cn(
          "ahd-celebrate relative my-auto w-full rounded-[2rem] p-8 text-center outline-none sm:p-14",
          "border bg-[var(--surface-raised)]",
          whole
            ? "border-[var(--gold)]/45 shadow-[0_50px_140px_-30px_rgba(0,0,0,0.75)]"
            : "border-[var(--line-strong)] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.7)]",
          weight.panel,
        )}
      >
        <Illuminated inset="1rem" />
        <span
          aria-hidden
          className={cn("ahd-rays pointer-events-none absolute inset-0 rounded-[2rem]", weight.rays)}
        />

        <div className="relative">
          <span
            className={cn(
              "ahd-seal-rise relative mx-auto grid place-items-center",
              weight.seal,
            )}
          >
            <span aria-hidden className="ahd-seal-halo absolute inset-0 rounded-full" />
            <span
              aria-hidden
              className="ahd-bloom absolute -inset-[120%] [animation-delay:0.15s]"
            />
            <Khatim className="relative h-full w-full text-[var(--gold)]" />
            <span className="absolute font-[family-name:var(--font-display)] text-[1.75rem] leading-none text-[var(--gold-ink)] tabular-nums">
              {whole ? 30 : many ? juz.length : first}
            </span>
          </span>

          <p className="ahd-celebrate-line mt-8 font-arabic text-[1.5rem] leading-[1.9] text-[var(--gold-ink)] [animation-delay:0.5s] sm:text-[1.75rem]">
            {whole ? "﴿ وَقُلْ رَبِّ زِدْنِي عِلْمًا ﴾" : "الْحَمْدُ لِلّٰهِ"}
          </p>

          <h2
            className={cn(
              "ahd-celebrate-line mt-3 font-[family-name:var(--font-display)] leading-tight font-light text-[var(--text-strong)] [animation-delay:0.65s]",
              whole ? "text-[2.25rem] sm:text-[3rem]" : "text-[2rem] sm:text-[2.5rem]",
            )}
          >
            {whole
              ? t("hafizTitle")
              : many
                ? t("titleMany", { count: juz.length })
                : t("title", { juz: first })}
          </h2>

          {whole && (
            <p className="ahd-celebrate-line mt-3 font-[family-name:var(--font-display)] text-[1.5rem] text-[var(--gold-ink)] [animation-delay:0.72s]">
              {name}
            </p>
          )}

          <p className="ahd-celebrate-line mx-auto mt-5 max-w-md text-[0.9375rem] leading-relaxed text-[var(--text-muted)] [animation-delay:0.8s]">
            {whole ? t("hafizBody") : t(`tier.${tier}`, { total })}
          </p>

          {/* The crown. Kept for thirty alone — it is the whole reason many
              people start, and spending it earlier would spend it. */}
          {whole && (
            <>
              <StarRule className="ahd-celebrate-line mx-auto mt-9 max-w-xs [animation-delay:0.9s]" />
              <blockquote className="ahd-celebrate-line mx-auto mt-7 max-w-lg [animation-delay:1s]">
                <p className="font-[family-name:var(--font-display)] text-[1.25rem] leading-[1.7] text-[var(--text-strong)] italic sm:text-[1.5rem]">
                  &ldquo;{t("crown")}&rdquo;
                </p>
                <footer className="mt-4 text-[0.6875rem] tracking-[0.18em] text-[var(--text-faint)] uppercase">
                  {t("crownSource")}
                </footer>
              </blockquote>
            </>
          )}

          <button
            type="button"
            onClick={close}
            className={cn(
              buttonStyles({ size: "lg" }),
              "ahd-celebrate-line mt-10 [animation-delay:1.15s]",
            )}
          >
            {whole ? t("hafizContinue") : t("continue")}
          </button>
        </div>
      </div>
    </div>
  );
}
