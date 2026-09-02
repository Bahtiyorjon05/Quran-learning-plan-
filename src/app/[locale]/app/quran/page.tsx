import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db/client";
import { memorizationUnits } from "@/db/schema";
import { requireOnboardedUser } from "@/auth/guard";
import { localisedSurahs, type QuranLocale } from "@/data/quran/loader";
import { pagesOfJuz, TOTAL_JUZ, TOTAL_PAGES } from "@/core/quran/mushaf";
import { AppHeader } from "@/components/app/app-header";
import { Atmosphere } from "@/components/app/atmosphere";
import { MushafMosaic } from "@/components/app/mushaf-mosaic";
import { SurahIndex } from "@/components/quran/surah-index";
import { Measure } from "@/components/ui/section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app.mushaf");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function AppMushafPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireOnboardedUser();
  const t = await getTranslations("app.mushaf");

  const units = await db
    .select({ page: memorizationUnits.page, strength: memorizationUnits.strength })
    .from(memorizationUnits)
    .where(eq(memorizationUnits.userId, user.id));

  /* One array of 604, indexed by page − 1. Building it here keeps the mosaic a
     dumb renderer rather than something that queries. */
  const strengths = new Array<number>(TOTAL_PAGES).fill(0);
  for (const unit of units) strengths[unit.page - 1] = unit.strength;

  const held = units.length;
  const averageStrength = held
    ? Math.round(units.reduce((sum, u) => sum + u.strength, 0) / held)
    : 0;

  const juz = Array.from({ length: TOTAL_JUZ }, (_, i) => {
    const { from, to } = pagesOfJuz(i + 1);
    return { juz: i + 1, from, to };
  });

  return (
    <div className="relative min-h-dvh">
      <Atmosphere />
      <AppHeader />

      <Measure className="relative z-10 py-10 sm:py-14">
        <div className="animate-rise">
          <h1 className="font-[family-name:var(--font-display)] text-[2rem] leading-tight font-light text-[var(--text-strong)] sm:text-[2.5rem]">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
            {t("subtitle")}
          </p>
        </div>

        <MushafMosaic
          strengths={strengths}
          held={held}
          averageStrength={averageStrength}
          basePath="/app/quran"
        />

        <div className="mt-14">
          <h2 className="mb-5 text-sm font-semibold text-[var(--text-strong)]">
            {t("browse")}
          </h2>
          <SurahIndex
            surahs={localisedSurahs(locale as QuranLocale)}
            juzStartPages={juz}
            basePath="/app/quran"
          />
        </div>
      </Measure>
    </div>
  );
}
