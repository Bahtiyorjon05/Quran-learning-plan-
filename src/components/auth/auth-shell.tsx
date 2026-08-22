import { useTranslations } from "next-intl";
import { ArrowLeft, Check } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Wordmark } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { ThemeToggle } from "@/components/site/theme-toggle";

/**
 * The frame every auth screen sits in.
 *
 * Exactly one seal is on screen at any width. Below `lg` there is no side
 * panel, so the wordmark sits in the form header and doubles as the way home —
 * which is what people already expect a logo to do. From `lg` up the panel
 * carries the wordmark instead and the form header falls back to a plain back
 * link, so the mark never appears twice on the same screen.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const t = useTranslations("auth.brand");
  const tn = useTranslations("nav");

  const points = [t("point1"), t("point2"), t("point3")];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,34rem)]">
      {/* ── The reason you are signing up (desktop only) ── */}
      <aside className="relative hidden overflow-hidden bg-[var(--surface-raised)]/40 lg:block">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="animate-breathe absolute start-[-6rem] top-[-8rem] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,var(--halo),transparent_65%)] blur-3xl" />
          <div className="absolute end-[-10rem] bottom-[-10rem] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-gold-500)_12%,transparent),transparent_68%)] blur-3xl" />
          <div className="girih absolute inset-0 opacity-[0.05]" />
          {/* A soft seam into the form column rather than a hard edge. */}
          <div className="absolute inset-y-0 end-0 w-40 bg-[linear-gradient(to_right,transparent,var(--surface-base))]" />
        </div>

        <div className="relative flex h-full flex-col p-10 xl:p-14">
          <Link href="/" aria-label="Ahd" className="w-fit shrink-0">
            <Wordmark size={36} />
          </Link>

          {/* One centred composition. The du'a used to be pinned to the bottom
              of a justify-between column inside an overflow-hidden panel, so on
              a laptop-height viewport it was clipped away entirely — and its
              dir="rtl" pushed it to the right edge, stranded from everything
              else. It now opens the block, left-aligned with the quote it
              belongs to. */}
          <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto py-10">
            <div className="max-w-lg">
              <p
                lang="ar"
                className="font-arabic text-[1.75rem] leading-[1.8] text-gold-ink xl:text-[2rem]"
              >
                رَبِّ زِدْنِي عِلْمًا
              </p>
              <p className="mt-1 text-xs tracking-[0.14em] text-[var(--text-faint)] uppercase">
                {t("duaSource")}
              </p>

              <div
                aria-hidden
                className="my-8 h-px w-24 bg-[linear-gradient(90deg,var(--gold),transparent)]"
              />

              <blockquote>
                <p className="font-[family-name:var(--font-display)] text-[1.625rem] leading-[1.4] font-light text-[var(--text-strong)] italic xl:text-[2rem]">
                  “{t("quote")}”
                </p>
                <footer className="mt-4 text-xs tracking-[0.14em] text-[var(--text-faint)] uppercase">
                  {t("quoteSource")}
                </footer>
              </blockquote>

              <ul className="mt-12 space-y-4">
                {points.map((point) => (
                  <li key={point} className="flex items-start gap-3.5">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[var(--accent)]/40 bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]">
                      <Check className="h-3 w-3 text-[var(--accent)]" strokeWidth={2.5} />
                    </span>
                    <span className="text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </aside>

      {/* ── The form ── */}
      <main className="relative flex flex-col">
        <header className="flex items-center justify-between gap-3 p-5 sm:p-6">
          <Link href="/" aria-label={tn("home")} className="shrink-0 lg:hidden">
            <Wordmark size={32} />
          </Link>

          <Link
            href="/"
            className="hidden items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)] lg:inline-flex"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {tn("home")}
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center px-5 pt-4 pb-14 sm:px-8">
          <div className="animate-rise w-full max-w-md">
            <h1 className="font-[family-name:var(--font-display)] text-[2rem] leading-[1.15] font-light text-[var(--text-strong)] sm:text-[2.5rem]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
                {subtitle}
              </p>
            )}

            <div className="mt-9">{children}</div>

            {footer && (
              <div className="mt-8 border-t border-[var(--line-subtle)] pt-6 text-center text-sm text-[var(--text-muted)]">
                {footer}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
