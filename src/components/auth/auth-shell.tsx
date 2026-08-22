import { useTranslations } from "next-intl";
import { ArrowLeft, Check } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { AhdMark, Wordmark } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { ThemeToggle } from "@/components/site/theme-toggle";

/**
 * The frame every auth screen sits in.
 *
 * On a phone it is a single centred column — nothing but the form, because
 * that is the only thing the person came to do. From `lg` up, a second panel
 * appears carrying the hadith and three promises, so the reason to finish
 * signing up is on screen while they do it.
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
      {/* ── The reason (desktop only) ── */}
      <aside className="relative hidden overflow-hidden bg-[var(--surface-raised)]/40 lg:block">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="animate-breathe absolute start-1/2 top-1/4 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--halo),transparent_62%)] blur-3xl" />
          <div className="girih absolute inset-0 opacity-[0.04]" />
        </div>

        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <Link href="/" aria-label="Ahd">
            <Wordmark />
          </Link>

          <div className="max-w-md">
            <AhdMark className="h-9 w-9 opacity-80" />
            <blockquote className="mt-8">
              <p className="font-[family-name:var(--font-display)] text-[1.75rem] leading-[1.4] font-light text-[var(--text-strong)] italic xl:text-[2rem]">
                “{t("quote")}”
              </p>
              <footer className="mt-4 text-xs tracking-[0.14em] text-[var(--text-faint)] uppercase">
                {t("quoteSource")}
              </footer>
            </blockquote>

            <ul className="mt-12 space-y-4">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-3">
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

          <p
            lang="ar"
            dir="rtl"
            className="font-arabic text-lg text-gold-300/50"
            aria-hidden
          >
            رَبِّ زِدْنِي عِلْمًا
          </p>
        </div>
      </aside>

      {/* ── The form ── */}
      <main className="relative flex flex-col">
        <header className="flex items-center justify-between gap-4 p-5 sm:p-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            <span className="lg:hidden">
              <Wordmark showArabic={false} />
            </span>
            <span className="hidden lg:inline">{tn("skipToContent")}</span>
          </Link>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
          <div className="animate-rise w-full max-w-md">
            <h1 className="font-[family-name:var(--font-display)] text-[2rem] leading-tight font-light text-[var(--text-strong)] sm:text-[2.5rem]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
                {subtitle}
              </p>
            )}

            <div className="mt-9">{children}</div>

            {footer && (
              <div className="mt-8 text-center text-sm text-[var(--text-muted)]">
                {footer}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
