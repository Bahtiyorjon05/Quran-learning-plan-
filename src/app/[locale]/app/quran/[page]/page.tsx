import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";

import { db } from "@/db/client";
import { memorizationUnits } from "@/db/schema";
import { requireOnboardedUser } from "@/auth/guard";
import { QURAN_META, TOTAL_PAGES, loadPage, surah as surahMeta } from "@/data/quran/loader";
import { AppHeader } from "@/components/app/app-header";
import { PageView } from "@/components/quran/page-view";
import { MemorizeToggle } from "@/components/quran/memorize-toggle";
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
  return { title: t("page", { page }), robots: { index: false, follow: false } };
}

/**
 * The same reader as the public one, with the account behind it.
 *
 * The page itself is rendered by the very same component, so the Arabic can
 * never drift between the two. What differs is the marking: here it writes to
 * the database and moves the covenant's progress, rather than living in one
 * browser's storage.
 */
export default async function AppQuranPage({ params }: Params) {
  const { locale, page: raw } = await params;
  const user = await requireOnboardedUser();

  const page = parsePage(raw);
  if (!page) notFound();

  const [{ meta, ayahs }, [unit]] = await Promise.all([
    loadPage(page),
    db
      .select({ page: memorizationUnits.page })
      .from(memorizationUnits)
      .where(
        and(
          eq(memorizationUnits.userId, user.id),
          eq(memorizationUnits.page, page),
          eq(memorizationUnits.state, "memorized"),
        ),
      )
      .limit(1),
  ]);

  const t = await getTranslations("quran.reader");
  const tm = await getTranslations("app.mushaf");
  const names = meta.surahs.map((n) => surahMeta(n));

  return (
    <div className="min-h-dvh">
      <AppHeader />

      <div className="sticky top-16 z-30 border-b border-[var(--line-subtle)] bg-[color-mix(in_oklab,var(--surface-base)_88%,transparent)] backdrop-blur-xl sm:top-18">
        <Measure className="flex h-14 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/app/quran"
              aria-label={tm("title")}
              className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--line-subtle)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]"
            >
              <LayoutGrid className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--text-strong)]">
                {names.map((s) => s.latin).join(" · ")}
              </p>
              <p className="text-[0.6875rem] text-[var(--text-faint)] tabular-nums">
                {t("page", { page })} · {t("juz", { juz: meta.juz })}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {page > 1 && (
              <Link
                href={`/app/quran/${page - 1}`}
                aria-label={t("prev")}
                className="inline-grid h-9 w-9 place-items-center rounded-full border border-[var(--line-subtle)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]"
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              </Link>
            )}
            {page < TOTAL_PAGES && (
              <Link
                href={`/app/quran/${page + 1}`}
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
        <div className="mx-auto flex max-w-2xl justify-end">
          <MemorizeToggle page={page} memorized={Boolean(unit)} />
        </div>
      </Measure>

      <Measure className="pb-16">
        <PageView ayahs={ayahs} locale={locale as Locale} />

        <div className="mx-auto mt-10 flex max-w-2xl items-center justify-between gap-3 border-t border-[var(--line-subtle)] pt-8">
          {page > 1 ? (
            <Link
              href={`/app/quran/${page - 1}`}
              className={buttonStyles({ variant: "outline" })}
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              {t("prev")}
            </Link>
          ) : (
            <span />
          )}
          {page < TOTAL_PAGES && (
            <Link href={`/app/quran/${page + 1}`} className={buttonStyles()}>
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
    </div>
  );
}
