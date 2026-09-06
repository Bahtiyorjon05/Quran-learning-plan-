"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Illuminated, Khatim } from "@/components/ui/illumination";
import { buttonStyles } from "@/components/ui/button";
import { markJuzSeenAction } from "@/app/[locale]/app/milestone-actions";
import { cn } from "@/lib/utils";

/**
 * The moment a juz is finished.
 *
 * Deliberately a moment and not a toast. Finishing a juz is the work of weeks
 * or months, and a strip that slides in over the corner of a dashboard and
 * slides out again four seconds later is an insult to it — the reader has to
 * be able to sit with this, and to close it themselves.
 *
 * Everything drawn here is the language the rest of the app already uses: the
 * illuminated frame, the eight-pointed khatim, gold on the night ground. The
 * only thing added for the occasion is time — the frame draws itself, the seal
 * lights, the words arrive after it. Nothing bounces.
 *
 * Shown once. The dashboard hands over any juz finished but never celebrated —
 * so one finished on a phone at midnight is still marked on the laptop in the
 * morning — and closing it writes that down.
 */
export function JuzCelebration({ juz, total }: { juz: number[]; total: number }) {
  const t = useTranslations("app.milestone");
  const [open, setOpen] = useState(true);
  const dialog = useRef<HTMLDivElement>(null);

  /* Escape closes it, like any other thing laid over the page. */
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
      aria-label={t("title", { juz: first })}
      className="fixed inset-0 z-[100] grid place-items-center p-4"
    >
      {/* The ground goes dark and stays dark: this is not a panel floating над
          the dashboard, it is a page of its own for as long as it is open. */}
      <button
        type="button"
        aria-label={t("close")}
        onClick={close}
        className="absolute inset-0 cursor-default bg-[color-mix(in_oklab,var(--surface-base)_82%,transparent)] backdrop-blur-md"
      />

      <div
        ref={dialog}
        tabIndex={-1}
        className={cn(
          "ahd-celebrate relative w-full max-w-lg rounded-[2rem] p-10 text-center outline-none sm:p-14",
          "border border-[var(--line-strong)] bg-[var(--surface-raised)]",
          "shadow-[0_40px_120px_-30px_rgba(0,0,0,0.7)]",
        )}
      >
        <Illuminated inset="1rem" />

        {/* The rays. Behind everything, turning slowly, so the seal reads as
            lit from within rather than printed on top. */}
        <span aria-hidden className="ahd-rays pointer-events-none absolute inset-0 rounded-[2rem]" />

        <div className="relative">
          <span className="ahd-seal-rise relative mx-auto grid h-28 w-28 place-items-center">
            <span aria-hidden className="ahd-seal-halo absolute inset-0 rounded-full" />
            <Khatim className="relative h-full w-full text-[var(--gold)]" />
            <span className="absolute font-[family-name:var(--font-display)] text-[1.75rem] leading-none text-[var(--gold-ink)] tabular-nums">
              {many ? juz.length : first}
            </span>
          </span>

          <p className="ahd-celebrate-line mt-8 font-arabic text-[1.5rem] leading-[1.9] text-[var(--gold-ink)] [animation-delay:0.5s]">
            الْحَمْدُ لِلّٰهِ
          </p>

          <h2 className="ahd-celebrate-line mt-3 font-[family-name:var(--font-display)] text-[2rem] leading-tight font-light text-[var(--text-strong)] [animation-delay:0.65s] sm:text-[2.5rem]">
            {many ? t("titleMany", { count: juz.length }) : t("title", { juz: first })}
          </h2>

          <p className="ahd-celebrate-line mx-auto mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-[var(--text-muted)] [animation-delay:0.8s]">
            {t("body", { total })}
          </p>

          {/* Thirty is not another number. */}
          {total === 30 && (
            <p className="ahd-celebrate-line mt-4 text-[0.9375rem] font-medium text-[var(--gold-ink)] [animation-delay:0.9s]">
              {t("whole")}
            </p>
          )}

          <button
            type="button"
            onClick={close}
            className={cn(
              buttonStyles({ size: "lg" }),
              "ahd-celebrate-line mt-9 [animation-delay:1s]",
            )}
          >
            {t("continue")}
          </button>
        </div>
      </div>
    </div>
  );
}
