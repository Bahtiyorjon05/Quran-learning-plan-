import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { localisedSurahs, type QuranLocale } from "@/data/quran/loader";
import { pagesOfJuz, TOTAL_JUZ } from "@/core/quran/mushaf";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { SurahIndex } from "@/components/quran/surah-index";
import { ReadTally } from "@/components/quran/reader-controls";
import { Measure } from "@/components/ui/section";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "quran.index" });
  return { title: t("title"), description: t("subtitle") };
}

export default async function QuranIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("quran.index");

  const juz = Array.from({ length: TOTAL_JUZ }, (_, i) => {
    const { from, to } = pagesOfJuz(i + 1);
    return { juz: i + 1, from, to };
  });

  return (
    <>
      <Header />
      <main id="main" className="pt-16 sm:pt-18">
        <Measure className="py-12 sm:py-16">
          <div className="animate-rise">
            <h1 className="font-[family-name:var(--font-display)] text-[2.25rem] leading-tight font-light text-[var(--text-strong)] sm:text-[2.75rem]">
              {t("title")}
            </h1>
            <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
              {t("subtitle")}
            </p>
            <div className="mt-3">
              <ReadTally />
            </div>
          </div>

          <div className="mt-10">
            <SurahIndex
              continuous
              surahs={localisedSurahs(locale as QuranLocale)}
              juzStartPages={juz}
            />
          </div>
        </Measure>
      </main>
      <Footer />
    </>
  );
}
