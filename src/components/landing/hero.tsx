import { useTranslations } from "next-intl";
import { ArrowRight, BookOpen } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";
import { TodayPreview } from "./today-preview";
import { cn } from "@/lib/utils";

export function Hero() {
  const t = useTranslations("landing.hero");

  const stats = [
    { value: "604", label: t("statPages") },
    { value: "9 060", label: t("statLines") },
    { value: "30", label: t("statJuz") },
    { value: "3", label: t("statTracks") },
  ];

  return (
    <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 lg:pt-44 lg:pb-28">
      {/* ── Ground: a slow emerald dawn behind a girih lattice ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="animate-breathe absolute start-1/2 top-[-22rem] h-[46rem] w-[46rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--halo),transparent_62%)] blur-3xl" />
        <div className="absolute end-[-14rem] top-32 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-gold-500)_14%,transparent),transparent_65%)] blur-3xl" />
        <div className="girih absolute inset-0 opacity-[0.035]" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(to_bottom,transparent,var(--surface-base))]" />
      </div>

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
                  <span className="block font-[family-name:var(--font-display)] text-3xl font-light text-[var(--text-strong)] tabular-nums">
                    {s.value}
                  </span>
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
