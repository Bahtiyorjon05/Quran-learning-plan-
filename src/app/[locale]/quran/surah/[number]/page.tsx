import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  SURAHS,
  loadSurahAyahs,
  localisedSurah,
  surah as surahMeta,
  type QuranLocale,
} from "@/data/quran/loader";
import { ReadingShell } from "@/components/quran/reading-shell";
import type { Locale } from "@/i18n/routing";

type Params = { params: Promise<{ locale: string; number: string }> };

function parseSurah(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= SURAHS.length ? n : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, number: raw } = await params;
  const n = parseSurah(raw);
  if (!n) return {};
  const named = localisedSurah(n, locale as QuranLocale);
  const t = await getTranslations({ locale, namespace: "quran.reader" });
  return { title: `${named.title} · ${t("wholeSurah")}` };
}

export default async function SurahReadingPage({ params }: Params) {
  const { locale, number: raw } = await params;
  setRequestLocale(locale);

  const n = parseSurah(raw);
  if (!n) notFound();

  const [t, ayahs] = await Promise.all([
    getTranslations("quran.reader"),
    loadSurahAyahs(n),
  ]);

  const named = localisedSurah(n, locale as QuranLocale);
  const info = surahMeta(n);

  return (
    <ReadingShell
      title={named.title}
      subtitle={`${t("wholeSurah")} · ${t("ayahCount", { count: info.ayahs })}`}
      ayahs={ayahs}
      locale={locale as Locale}
      offlineUnit={`surah-${n}`}
      previous={
        n > 1
          ? { href: `/quran/surah/${n - 1}`, label: t("prevSurah") }
          : undefined
      }
      next={
        n < SURAHS.length
          ? { href: `/quran/surah/${n + 1}`, label: t("nextSurah") }
          : undefined
      }
      alsoBy={[
        { href: `/quran/surah/${n}`, label: t("bySurah"), current: true },
        { href: `/quran/${info.startPage}`, label: t("byPage") },
      ]}
    />
  );
}
