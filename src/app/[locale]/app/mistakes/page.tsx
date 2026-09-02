import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CircleCheck, Sparkles } from "lucide-react";

import { requireOnboardedUser } from "@/auth/guard";
import { AppHeader } from "@/components/app/app-header";
import { Atmosphere } from "@/components/app/atmosphere";
import { WeakSpots } from "@/components/app/weak-spots";
import { Measure } from "@/components/ui/section";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { QuranLocale } from "@/data/quran/loader";

import { loadSummary, loadWeakSpots } from "./data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mistakes");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Where the memory keeps failing.
 *
 * The counterpart to practice: practice asks the questions, this reports what
 * the answers said. Ordered by how often an ayah has gone wrong rather than by
 * when — the point is the persistent gaps, not the recent ones.
 */
export default async function MistakesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireOnboardedUser();
  const t = await getTranslations("mistakes");

  const [spots, summary] = await Promise.all([
    loadWeakSpots(user.id, locale as QuranLocale),
    loadSummary(user.id),
  ]);

  return (
    <>
      <Atmosphere />
      <AppHeader />

      <main className="relative z-10 py-10 sm:py-14">
        <Measure>
          <header>
            <h1 className="font-[family-name:var(--font-display)] text-[2rem] leading-tight font-light text-[var(--text-strong)] sm:text-[2.5rem]">
              {t("title")}
            </h1>
            <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
              {t("subtitle")}
            </p>
          </header>

          {spots.length === 0 ? (
            <div className="mt-10 rounded-3xl border border-dashed border-[var(--line-strong)] px-6 py-14 text-center">
              <CircleCheck className="mx-auto h-6 w-6 text-[var(--accent)]" strokeWidth={1.5} />
              <p className="mt-4 text-[0.9375rem] text-[var(--text-strong)]">
                {summary.resolved > 0 ? t("allClear") : t("nothingYet")}
              </p>
              <p className="mx-auto mt-2 max-w-sm text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
                {summary.resolved > 0
                  ? t("allClearBody", { count: summary.resolved })
                  : t("nothingYetBody")}
              </p>
              <Link
                href="/app/practice"
                className={buttonStyles({ size: "lg", className: "mt-6 group" })}
              >
                <Sparkles className="h-4 w-4" />
                {t("goPractise")}
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-[var(--text-faint)]">
                <span>{t("openCount", { ayahs: summary.ayahs, times: summary.open })}</span>
                {summary.resolved > 0 && (
                  <span className="text-[var(--accent-strong)]">
                    {t("resolvedCount", { count: summary.resolved })}
                  </span>
                )}
              </p>

              <div className="mt-5">
                <WeakSpots spots={spots} />
              </div>

              <p className="mt-8 text-[0.75rem] leading-relaxed text-[var(--text-faint)]">
                {t("footnote")}
              </p>
            </>
          )}
        </Measure>
      </main>
    </>
  );
}
