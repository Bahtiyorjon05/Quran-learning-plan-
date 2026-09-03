import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";

import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { PageView } from "@/components/quran/page-view";
import { ReaderControls } from "@/components/quran/reader-controls";
import { Recitation } from "@/components/quran/recitation";
import { OfflineAudio } from "@/components/quran/offline-audio";
import { Measure } from "@/components/ui/section";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Ayah } from "@/data/quran/loader";
import type { Locale } from "@/i18n/routing";

/**
 * Reading a whole surah, or a whole juz.
 *
 * The mushaf is bound in pages and hifz is measured in them, so the page
 * reader stays exactly as it was. But nobody thinks of Ya-Sin as pages 440 to
 * 445, and nobody revising a juz wants to press "next" twenty times — so the
 * two units people actually name get their own way in, sharing every part of
 * the page reader that was already right: the same controls, the same player,
 * the same verses.
 *
 * The recitation runs the whole way through, which is the point. A juz is
 * two hundred verses in one continuous listen rather than twenty pages each
 * needing a fresh press of play.
 */
export function ReadingShell({
  title,
  subtitle,
  ayahs,
  locale,
  offlineUnit,
  previous,
  next,
  alsoBy,
}: {
  title: string;
  subtitle: string;
  ayahs: Ayah[];
  locale: Locale;
  /** Stable name for the offline download: "juz-30", "surah-36". */
  offlineUnit: string;
  previous?: { href: string; label: string };
  next?: { href: string; label: string };
  /** The other ways to read this same place. */
  alsoBy: { href: string; label: string; current?: boolean }[];
}) {
  return (
    <>
      <Header />
      <main id="main" className="pt-16 sm:pt-18">
        <div className="sticky top-16 z-30 border-b border-[var(--line-subtle)] bg-[color-mix(in_oklab,var(--surface-base)_88%,transparent)] backdrop-blur-xl sm:top-18">
          <Measure className="flex h-14 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/quran"
                aria-label={subtitle}
                className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--line-subtle)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]"
              >
                <LayoutGrid className="h-4 w-4" />
              </Link>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--text-strong)]">{title}</p>
                <p className="truncate text-[0.6875rem] text-[var(--text-faint)] tabular-nums">
                  {subtitle}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {previous && (
                <Link
                  href={previous.href}
                  aria-label={previous.label}
                  className="inline-grid h-9 w-9 place-items-center rounded-full border border-[var(--line-subtle)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]"
                >
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                </Link>
              )}
              {next && (
                <Link
                  href={next.href}
                  aria-label={next.label}
                  className="inline-grid h-9 w-9 place-items-center rounded-full border border-[var(--line-subtle)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]"
                >
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </Link>
              )}
            </div>
          </Measure>
        </div>

        <Measure className="py-6">
          <div className="mx-auto max-w-2xl space-y-4">
            {/* The same place, read three ways. Whichever you are in is marked,
                so this reads as where you are rather than as a menu. */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <nav className="inline-flex items-center gap-0.5 rounded-full border border-[var(--line-subtle)] bg-[var(--surface-raised)]/60 p-0.5">
                {alsoBy.map((option) => (
                  <Link
                    key={option.href}
                    href={option.href}
                    aria-current={option.current ? "page" : undefined}
                    className={
                      option.current
                        ? "rounded-full bg-[var(--accent-ground)] px-3 py-1.5 text-[0.75rem] font-medium text-[var(--on-accent)]"
                        : "rounded-full px-3 py-1.5 text-[0.75rem] text-[var(--text-muted)] transition-colors duration-300 hover:text-[var(--text-strong)]"
                    }
                  >
                    {option.label}
                  </Link>
                ))}
              </nav>

              <ReaderControls />
            </div>

            <Recitation ayahs={ayahs.map((a) => ({ k: a.k, s: a.s, a: a.a }))} />

            <OfflineAudio unit={offlineUnit} ayahs={ayahs.map((a) => ({ s: a.s, a: a.a }))} />
          </div>
        </Measure>

        <Measure className="pb-16">
          <PageView ayahs={ayahs} locale={locale} />

          <div className="mx-auto mt-10 flex max-w-2xl items-center justify-between gap-3 border-t border-[var(--line-subtle)] pt-8">
            {previous ? (
              <Link href={previous.href} className={buttonStyles({ variant: "outline" })}>
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                {previous.label}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={next.href} className={buttonStyles({ variant: "outline" })}>
                {next.label}
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            ) : (
              <span />
            )}
          </div>
        </Measure>
      </main>
      <Footer />
    </>
  );
}
