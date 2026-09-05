import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  BookOpen,
  Eye,
  ListOrdered,
  MoveRight,
  Shuffle,
  Sparkles,
  SquareDashed,
  Type,
} from "lucide-react";

import { requireOnboardedUser } from "@/auth/guard";
import { AppHeader } from "@/components/app/app-header";
import { Atmosphere } from "@/components/app/atmosphere";
import { Illuminated } from "@/components/ui/illumination";
import { Measure } from "@/components/ui/section";
import { buttonStyles } from "@/components/ui/button";
import { DRILL_MODES } from "@/core/drill/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { QuranLocale } from "@/data/quran/loader";

import { PRACTICE_SHORTLIST, heldPageCount, practicablePages } from "./session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("practice");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** One glyph per drill mode, in the order the modes are declared. */
const MODE_ICON = {
  hide: Eye,
  firstWord: Type,
  next: MoveRight,
  shuffle: Shuffle,
  gap: SquareDashed,
  mutashabihat: ListOrdered,
} as const;

/**
 * Which page to test yourself on.
 *
 * Ordered weakest first, which is the whole argument for tracking strength: a
 * reciter left to choose will pick what they enjoy reciting, and what they
 * enjoy reciting is what they know best.
 *
 * The shape of the screen answers two questions in order. *Where do I start* —
 * one card, the weakest page, large enough that it is plainly the answer and
 * not merely the first row of a list. Then *what is going to happen to me* —
 * the six drills named, because "practice" on its own is a word that could
 * mean rereading, and the whole argument of this app is that rereading is not
 * revision.
 *
 * The rest of the shortlist is a grid rather than a column of full-width rows.
 * A row holding a number, a surah name and a date was three hundred pixels of
 * content stretched across fourteen hundred, twelve times over — a wall to
 * scroll past rather than a set of choices to scan.
 */
export default async function PracticeIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireOnboardedUser();
  const t = await getTranslations("practice");

  const [pages, held] = await Promise.all([
    practicablePages(user.id, locale as QuranLocale),
    heldPageCount(user.id),
  ]);

  const shortlist = pages.slice(0, PRACTICE_SHORTLIST);
  const [featured, ...rest] = shortlist;

  return (
    <div className="relative min-h-dvh">
      <Atmosphere />
      <AppHeader />

      <main className="relative z-10 py-10 sm:py-14">
        <Measure>
          <header className="max-w-2xl">
            <h1 className="font-[family-name:var(--font-display)] text-[2rem] leading-tight font-light text-[var(--text-strong)] sm:text-[2.5rem]">
              {t("title")}
            </h1>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
              {t("subtitle")}
            </p>
          </header>

          {held === 0 ? (
            <div className="mt-10 rounded-3xl border border-dashed border-[var(--line-strong)] px-6 py-12 text-center">
              <BookOpen className="mx-auto h-6 w-6 text-[var(--text-faint)]" strokeWidth={1.5} />
              <p className="mt-4 text-[0.9375rem] text-[var(--text-strong)]">{t("empty.title")}</p>
              <p className="mx-auto mt-2 max-w-sm text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
                {t("empty.body")}
              </p>
              <Link
                href="/app/quran"
                className={buttonStyles({ size: "lg", className: "mt-6 group" })}
              >
                {t("empty.action")}
              </Link>
            </div>
          ) : (
            <>
              {featured && (
                <section className="mt-8">
                  <SectionLabel icon={Sparkles}>{t("startHere")}</SectionLabel>

                  <Link
                    href={`/app/practice/${featured.page}`}
                    className={cn(
                      "group panel panel-interactive relative mt-3 block overflow-hidden rounded-3xl p-6 sm:p-8",
                      featured.fragile && "!border-gold-500/40 hover:!border-gold-500/70",
                    )}
                  >
                    <div
                      aria-hidden
                      className="girih pointer-events-none absolute inset-0 opacity-[0.03]"
                    />
                    <Illuminated inset="0.625rem" />

                    <div className="relative flex flex-wrap items-center gap-6 sm:gap-8">
                      <span
                        className={cn(
                          "font-[family-name:var(--font-display)] text-[3.5rem] leading-none font-light tabular-nums sm:text-[4.5rem]",
                          featured.fragile ? "text-gold-ink" : "text-[var(--accent-strong)]",
                        )}
                      >
                        {featured.page}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-[family-name:var(--font-display)] text-[1.5rem] leading-tight font-normal text-[var(--text-strong)] sm:text-[1.75rem]">
                          {featured.surahNames.join(" · ")}
                        </span>
                        <span className="mt-1.5 block text-[0.875rem] text-[var(--text-muted)]">
                          {t("juzNumber", { number: featured.juz })}
                          {featured.daysSinceReview > 0 && (
                            <> · {t("daysAgo", { count: featured.daysSinceReview })}</>
                          )}
                        </span>

                        <span className="mt-4 flex items-center gap-3">
                          <span
                            aria-hidden
                            className="h-2 max-w-64 flex-1 overflow-hidden rounded-full bg-[var(--line-strong)]"
                          >
                            <span
                              className={cn(
                                "block h-full rounded-full",
                                featured.fragile ? "bg-gold-500" : "bg-[var(--accent)]",
                              )}
                              style={{ width: `${Math.max(3, featured.strength)}%` }}
                            />
                          </span>
                          <span className="shrink-0 text-[0.75rem] tracking-[0.1em] text-[var(--text-faint)] uppercase">
                            {t("strength")} {featured.strength}
                          </span>
                        </span>
                      </span>

                      <span
                        className={buttonStyles({
                          size: "lg",
                          className: "pointer-events-none hidden shrink-0 sm:inline-flex",
                        })}
                      >
                        {t("startAction")}
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180" />
                      </span>
                      <ArrowRight className="h-5 w-5 shrink-0 text-[var(--text-faint)] transition-transform duration-300 group-hover:translate-x-1 sm:hidden rtl:rotate-180" />
                    </div>
                  </Link>
                </section>
              )}

              {/* What is actually going to happen. "Practice" could mean
                  rereading, and the argument of this whole app is that
                  rereading is not revision — so the six drills are named
                  rather than hidden behind the word. */}
              <section className="mt-10">
                <SectionLabel>{t("modesTitle")}</SectionLabel>
                <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  {DRILL_MODES.map((mode) => {
                    const Icon = MODE_ICON[mode];
                    return (
                      <li
                        key={mode}
                        className="flex items-start gap-3 rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-raised)]/40 px-4 py-3.5"
                      >
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] text-[var(--accent-strong)]">
                          <Icon className="h-4 w-4" strokeWidth={1.7} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[0.875rem] font-medium text-[var(--text-strong)]">
                            {t(`modes.${mode}.name`)}
                          </span>
                          <span className="mt-0.5 block text-[0.75rem] leading-relaxed text-[var(--text-faint)]">
                            {t(`modes.${mode}.title`)}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {rest.length > 0 && (
                <section className="mt-10">
                  <SectionLabel>{t("othersTitle")}</SectionLabel>
                  <p className="mt-1 text-[0.8125rem] text-[var(--text-faint)]">
                    {t("weakestFirst", { count: held })}
                  </p>

                  <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                    {rest.map((item) => (
                      <li key={item.page}>
                        <Link
                          href={`/app/practice/${item.page}`}
                          className={cn(
                            "panel panel-interactive group flex h-full flex-col rounded-2xl p-4",
                            item.fragile && "!border-gold-500/35 hover:!border-gold-500/60",
                          )}
                        >
                          <span className="flex items-baseline justify-between gap-3">
                            <span
                              className={cn(
                                "font-[family-name:var(--font-display)] text-[1.75rem] leading-none font-light tabular-nums",
                                item.fragile
                                  ? "text-gold-ink"
                                  : "text-[var(--accent-strong)]",
                              )}
                            >
                              {item.page}
                            </span>
                            <span
                              className={cn(
                                "text-[0.8125rem] font-medium tabular-nums",
                                item.fragile ? "text-gold-ink" : "text-[var(--text-muted)]",
                              )}
                            >
                              {item.strength}
                              <span className="ms-1 text-[0.6875rem] text-[var(--text-faint)]">
                                {t("strengthLabel")}
                              </span>
                            </span>
                          </span>

                          <span className="mt-2.5 block truncate text-[0.9375rem] font-medium text-[var(--text-strong)]">
                            {item.surahNames.join(" · ")}
                          </span>
                          <span className="mt-0.5 block text-[0.75rem] text-[var(--text-muted)]">
                            {t("juzNumber", { number: item.juz })}
                            {item.daysSinceReview > 0 && (
                              <> · {t("daysAgo", { count: item.daysSinceReview })}</>
                            )}
                          </span>

                          {/* Pushed to the foot of the card so every tile in a
                              row rules off at the same height, whatever the
                              surah names did to the line above. */}
                          <span aria-hidden className="mt-auto block pt-4">
                            <span className="block h-1.5 w-full overflow-hidden rounded-full bg-[var(--line-strong)]">
                              <span
                                className={cn(
                                  "block h-full rounded-full transition-[width] duration-700 ease-[var(--ease-calm)]",
                                  item.fragile ? "bg-gold-500" : "bg-[var(--accent)]",
                                )}
                                style={{ width: `${Math.max(3, item.strength)}%` }}
                              />
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>

                  {pages.length > shortlist.length && (
                    <p className="mt-5 text-center text-[0.8125rem] text-[var(--text-faint)]">
                      {t("andMore", { count: pages.length - shortlist.length })}
                    </p>
                  )}
                </section>
              )}
            </>
          )}
        </Measure>
      </main>
    </div>
  );
}

/** The small capital rule that opens each band of the page. */
function SectionLabel({
  icon: Icon,
  children,
}: {
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-2 text-[0.75rem] font-semibold tracking-[0.16em] text-[var(--text-faint)] uppercase">
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />}
      {children}
    </h2>
  );
}
