import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Info } from "lucide-react";

import { requireOnboardedUser } from "@/auth/guard";
import { TOTAL_PAGES, juzOfPage } from "@/core/quran/mushaf";
import { DRILL_MODES, type DrillMode } from "@/core/drill/types";
import { pageMeta, surah as surahMeta } from "@/data/quran/loader";
import { AppHeader } from "@/components/app/app-header";
import { DrillRunner } from "@/components/practice/drill-runner";
import { Measure } from "@/components/ui/section";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { buildSession, isHeld } from "../session";

type Params = {
  params: Promise<{ locale: string; page: string }>;
  searchParams: Promise<{ mode?: string; level?: string; n?: string }>;
};

function parsePage(raw: string): number | null {
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 && page <= TOTAL_PAGES ? page : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, page: raw } = await params;
  const page = parsePage(raw);
  if (!page) return {};
  const t = await getTranslations({ locale, namespace: "practice" });
  return { title: t("pageTitle", { page }), robots: { index: false, follow: false } };
}

/**
 * A drill on one page.
 *
 * The mode lives in the URL rather than in component state so a particular
 * drill can be linked to, reloaded without changing, and returned to from the
 * result screen — and so "the same page, harder" is just another link.
 */
export default async function PracticeSessionPage({ params, searchParams }: Params) {
  const { page: raw } = await params;
  const { mode: modeRaw, level: levelRaw, n } = await searchParams;

  const user = await requireOnboardedUser();
  const t = await getTranslations("practice");

  const page = parsePage(raw);
  if (!page) notFound();

  const mode = DRILL_MODES.includes(modeRaw as DrillMode) ? (modeRaw as DrillMode) : undefined;
  const level = clampLevel(levelRaw);

  const [session, held] = await Promise.all([
    buildSession({
      userId: user.id,
      page,
      mode,
      level,
      nonce: n ?? "",
    }),
    isHeld(user.id, page),
  ]);

  if (!session || session.drill.questions.length === 0) notFound();

  const names = pageMeta(page).surahs.map((number) => surahMeta(number).latin);

  return (
    <>
      <AppHeader />

      <main className="py-8 sm:py-12">
        <Measure>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/app/practice"
              className="inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--text-muted)] transition-colors duration-300 hover:text-[var(--text-strong)]"
            >
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              {t("allPages")}
            </Link>

            <p className="text-[0.8125rem] text-[var(--text-faint)]">
              {names.join(" · ")} · {t("pageNumber", { page })} ·{" "}
              {t("juzNumber", { number: juzOfPage(page) })}
            </p>
          </div>

          {/* The modes are shown as links, not a dropdown: they are six
              different things to do, and hiding five of them behind a control
              is how a feature goes unused. */}
          <nav className="mt-6 -mx-1 flex gap-1.5 overflow-x-auto pb-1">
            {session.modes.map((option) => (
              <Link
                key={option}
                href={
                  option === "hide"
                    ? `/app/practice/${page}?mode=hide`
                    : `/app/practice/${page}?mode=${option}`
                }
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-2 text-[0.8125rem] font-medium whitespace-nowrap",
                  "transition-[border-color,background-color,color] duration-300 ease-[var(--ease-calm)]",
                  option === session.drill.mode
                    ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] text-[var(--accent-strong)]"
                    : "border-[var(--line-strong)] text-[var(--text-muted)] hover:border-[var(--text-faint)] hover:text-[var(--text-strong)]",
                )}
              >
                {t(`modes.${option}.name`)}
              </Link>
            ))}
          </nav>

          <p className="mt-4 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
            {t(`modes.${session.drill.mode}.about`)}
          </p>

          {/* Said before the first question, not after the last one. Only a
              held page can be scored, and finding that out at the end of ten
              questions is how a tool loses someone's trust. */}
          {!held && (
            <p className="mt-5 flex items-start gap-2 rounded-xl border border-gold-500/30 bg-gold-500/10 px-4 py-3 text-[0.8125rem] text-gold-ink">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              {t("notHeldYet")}
            </p>
          )}

          <div className="mt-8">
            <DrillRunner
              /* Remounts when the drill changes, so answers from the previous
                 mode cannot survive into the next one. */
              key={`${session.drill.mode}-${session.seed}`}
              drill={session.drill}
              level={session.level}
              nonce={n ?? ""}
              names={session.names}
            />
          </div>
        </Measure>
      </main>
    </>
  );
}

function clampLevel(raw: string | undefined): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
