import { useTranslations } from "next-intl";
import { ArrowRight, BookOpen } from "lucide-react";

import { CountUp } from "@/components/ui/count-up";

import { Link } from "@/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";
import { HeroBackdrop } from "./hero-backdrop";
import { TodayPreview } from "./today-preview";
import { cn } from "@/lib/utils";

export function Hero() {
  const t = useTranslations("landing.hero");

  /* Counted up rather than printed. These four figures are the whole scale of
     the undertaking, and watching 9,060 arrive says it better than the number
     sitting there already does. */
  const stats = [
    { value: 604, label: t("statPages"), grouped: false },
    { value: 9060, label: t("statLines"), grouped: true },
    { value: 30, label: t("statJuz"), grouped: false },
    { value: 3, label: t("statTracks"), grouped: false },
  ];

  return (
    <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 lg:pt-44 lg:pb-28">
      <HeroBackdrop />

      <div className="measure grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        {/* ── Words ── */}
        <div className="animate-rise">
          <p className="inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] bg-[var(--surface-raised)]/60 px-3.5 py-1.5 text-xs font-medium tracking-wide text-[var(--text-muted)] backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {t("badge")}
          </p>

          <h1 className="mt-7 font-[family-name:var(--font-display)] text-[2.75rem] leading-[1.02] font-light tracking-[-0.02em] text-balance sm:text-6xl lg:text-[4.25rem]">
            <span className="block text-[var(--text-strong)]">{t("titleLine1")}</span>
            <span className="text-gradient-gold mt-1 block">{t("titleLine2")}</span>
          </h1>

          <p className="mt-7 max-w-xl text-[1.0625rem] leading-[1.75] text-[var(--text-muted)] sm:text-lg">
            {t("lead")}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/signup"
              className={buttonStyles({ size: "lg", className: "group" })}
            >
              {t("ctaPrimary")}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
            </Link>
            <Link
              href="/quran"
              className={buttonStyles({ variant: "outline", size: "lg" })}
            >
              <BookOpen className="h-4 w-4" />
              {t("ctaSecondary")}
            </Link>
          </div>

          <p className="mt-4 text-xs text-[var(--text-faint)]">{t("noAccount")}</p>

          <dl className="mt-12 grid max-w-lg grid-cols-2 gap-x-8 gap-y-6 border-t border-[var(--line-subtle)] pt-8 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <CountUp
                    value={s.value}
                    grouped={s.grouped}
                    className="block font-[family-name:var(--font-display)] text-3xl font-light text-[var(--text-strong)] tabular-nums"
                  />
                  <span className="mt-1 block text-xs tracking-wide text-[var(--text-faint)]">
                    {s.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── The product, not a stock illustration ── */}
        <div
          className={cn(
            "animate-rise relative mx-auto w-full max-w-md lg:max-w-none",
            "[animation-delay:180ms]",
          )}
        >
          <TodayPreview />
        </div>
      </div>
    </section>
  );
}
