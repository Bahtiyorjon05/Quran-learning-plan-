import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";

import {
  QURAN_META,
  TOTAL_PAGES,
  loadPage,
  localisedSurah,
  type QuranLocale,
} from "@/data/quran/loader";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { PageView } from "@/components/quran/page-view";
import { ReaderControls } from "@/components/quran/reader-controls";
import { Recitation } from "@/components/quran/recitation";
import { AutoReadMark } from "@/components/quran/auto-read-mark";
import { Measure } from "@/components/ui/section";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

type Params = { params: Promise<{ locale: string; page: string }> };

function parsePage(raw: string): number | null {
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 && page <= TOTAL_PAGES ? page : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, page: raw } = await params;
  const page = parsePage(raw);
  if (!page) return {};

  const t = await getTranslations({ locale, namespace: "quran.reader" });
  const names = QURAN_META.pages[page - 1].surahs
    .map((n) => localisedSurah(n, locale as QuranLocale).title)
    .join(", ");
  return { title: `${t("page", { page })} · ${names}` };
}

export default async function QuranPage({ params }: Params) {
  const { locale, page: raw } = await params;
  setRequestLocale(locale);

  const page = parsePage(raw);
  if (!page) notFound();

  const { meta, ayahs } = await loadPage(page);
  const t = await getTranslations("quran.reader");
  const names = meta.surahs.map((n) => localisedSurah(n, locale as QuranLocale));

  return (
    <>
      <Header />
      <main id="main" className="pt-16 sm:pt-18">
        {/* Where you are, and how to leave. Sticks under the header so the page
            number and the next/previous controls are always within reach. */}
        <div className="sticky top-16 z-30 border-b border-[var(--line-subtle)] bg-[color-mix(in_oklab,var(--surface-base)_88%,transparent)] backdrop-blur-xl sm:top-18">
          <Measure className="flex h-14 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/quran"
                aria-label={t("index")}
                className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--line-subtle)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]"
              >
                <LayoutGrid className="h-4 w-4" />
              </Link>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--text-strong)]">
                  {names.map((s) => s.title).join(" · ")}
                </p>
                <p className="text-[0.6875rem] text-[var(--text-faint)] tabular-nums">
                  {t("page", { page })} · {t("juz", { juz: meta.juz })}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {page > 1 && (
                <Link
                  href={`/quran/${page - 1}`}
                  aria-label={t("prev")}
                  className="inline-grid h-9 w-9 place-items-center rounded-full border border-[var(--line-subtle)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]"
                >
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                </Link>
              )}
              {page < TOTAL_PAGES && (
                <Link
                  href={`/quran/${page + 1}`}
                  aria-label={t("next")}
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
            <div className="flex justify-end">
              <ReaderControls />
            </div>
            <Recitation ayahs={ayahs.map((a) => ({ k: a.k, s: a.s, a: a.a }))} />
          </div>
        </Measure>

        <Measure className="pb-16">
          <PageView ayahs={ayahs} locale={locale as Locale} />

        <AutoReadMark page={page} />

          <div className="mx-auto mt-10 flex max-w-2xl items-center justify-between gap-3 border-t border-[var(--line-subtle)] pt-8">
            {page > 1 ? (
              <Link href={`/quran/${page - 1}`} className={buttonStyles({ variant: "outline" })}>
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                {t("prev")}
              </Link>
            ) : (
              <span />
            )}
            {page < TOTAL_PAGES && (
              <Link href={`/quran/${page + 1}`} className={buttonStyles()}>
                {t("next")}
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            )}
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-[var(--text-faint)]">
            {t("translationBy", {
              name:
                locale === "uz"
                  ? QURAN_META.editions.uz.label
                  : locale === "ru"
                    ? QURAN_META.editions.ru.label
                    : QURAN_META.editions.en.label,
            })}
          </p>
        </Measure>
      </main>
      <Footer />
    </>
  );
}
