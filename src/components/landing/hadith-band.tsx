import { useTranslations } from "next-intl";
import { AhdMark } from "@/components/brand/logo";

export function HadithBand() {
  const t = useTranslations("landing.hadith");

  return (
    <section className="relative overflow-hidden border-y border-[var(--line-subtle)] bg-[var(--surface-raised)]/40 py-20 sm:py-24">
      <div
        aria-hidden
        className="girih pointer-events-none absolute inset-0 opacity-[0.04]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute start-1/2 top-1/2 h-[24rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,color-mix(in_oklab,var(--color-gold-500)_10%,transparent),transparent_70%)] blur-3xl"
      />

      <div className="measure relative flex flex-col items-center text-center">
        <AhdMark size={72} className="opacity-90" />

        <blockquote className="mt-8">
          <p
            lang="ar"
            dir="rtl"
            className="font-arabic mx-auto max-w-3xl text-[1.75rem] leading-[2] text-gold-ink-strong/95 sm:text-[2.125rem] sm:leading-[2.1]"
          >
            {t("arabic")}
          </p>
          <p className="mx-auto mt-9 max-w-2xl font-[family-name:var(--font-display)] text-xl leading-[1.6] font-light text-[var(--text-strong)] italic sm:text-2xl">
            “{t("translation")}”
          </p>
          <footer className="mt-6 text-xs tracking-[0.14em] text-[var(--text-faint)] uppercase">
            {t("source")}
          </footer>
        </blockquote>

        <div className="rule-fade my-10 w-full max-w-sm" />

        <p className="max-w-lg text-sm leading-relaxed text-[var(--text-muted)]">
          {t("note")}
        </p>
      </div>
    </section>
  );
}
