import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BookOpen, Sparkles } from "lucide-react";

import { requireOnboardedUser } from "@/auth/guard";
import { AppHeader } from "@/components/app/app-header";
import { Measure } from "@/components/ui/section";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { PRACTICE_SHORTLIST, heldPageCount, practicablePages } from "./session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("practice");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Which page to test yourself on.
 *
 * Ordered weakest first, which is the whole argument for tracking strength: a
 * reciter left to choose will pick what they enjoy reciting, and what they
 * enjoy reciting is what they know best. The list is short on purpose — being
 * shown two hundred pages is a reason to close the tab.
 */
export default async function PracticeIndexPage() {
  const user = await requireOnboardedUser();
  const t = await getTranslations("practice");

  const [pages, held] = await Promise.all([
    practicablePages(user.id),
    heldPageCount(user.id),
  ]);

  const shortlist = pages.slice(0, PRACTICE_SHORTLIST);

  return (
    <>
      <AppHeader />

      <main className="py-10 sm:py-14">
        <Measure>
          <header>
            <h1 className="font-[family-name:var(--font-display)] text-[2rem] leading-tight font-light text-[var(--text-strong)] sm:text-[2.5rem]">
              {t("title")}
            </h1>
            <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
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
              <p className="mt-8 flex items-center gap-2 text-[0.8125rem] text-[var(--text-faint)]">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                {t("weakestFirst", { count: held })}
              </p>

              <ul className="mt-4 space-y-2.5">
                {shortlist.map((item) => (
                  <li key={item.page}>
                    <Link
                      href={`/app/practice/${item.page}`}
                      className={cn(
                        "flex items-center gap-4 rounded-2xl border px-4 py-4 sm:px-5",
                        "transition-[border-color,background-color] duration-300 ease-[var(--ease-calm)]",
                        item.fragile
                          ? "border-gold-500/35 hover:border-gold-500/60"
                          : "border-[var(--line-strong)] hover:border-[var(--accent)]/50",
                      )}
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-inset)]/60 text-[0.875rem] font-medium text-[var(--text-strong)] tabular-nums">
                        {item.page}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.9375rem] font-medium text-[var(--text-strong)]">
                          {item.surahNames.join(" · ")}
                        </span>
                        <span className="mt-0.5 block text-[0.75rem] text-[var(--text-muted)]">
                          {t("juzNumber", { number: item.juz })}
                          {item.daysSinceReview > 0 && (
                            <> · {t("daysAgo", { count: item.daysSinceReview })}</>
                          )}
                        </span>
                      </span>

                      <StrengthBar value={item.strength} fragile={item.fragile} />
                    </Link>
                  </li>
                ))}
              </ul>

              {pages.length > shortlist.length && (
                <p className="mt-5 text-center text-[0.8125rem] text-[var(--text-faint)]">
                  {t("andMore", { count: pages.length - shortlist.length })}
                </p>
              )}
            </>
          )}
        </Measure>
      </main>
    </>
  );
}

/** Strength as a bar, because a number alone is not a feeling. */
function StrengthBar({ value, fragile }: { value: number; fragile: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-2.5">
      <span
        aria-hidden
        className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-[var(--line-strong)] sm:block"
      >
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-700 ease-[var(--ease-calm)]",
            fragile ? "bg-gold-500" : "bg-[var(--accent)]",
          )}
          style={{ width: `${Math.max(3, value)}%` }}
        />
      </span>
      <span
        className={cn(
          "w-9 text-end text-[0.8125rem] font-medium tabular-nums",
          fragile ? "text-gold-ink" : "text-[var(--text-muted)]",
        )}
      >
        {value}
      </span>
    </span>
  );
}
