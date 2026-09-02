import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { QURAN_META, loadJuzAyahs } from "@/data/quran/loader";
import { ReadingShell } from "@/components/quran/reading-shell";
import type { Locale } from "@/i18n/routing";

type Params = { params: Promise<{ locale: string; number: string }> };

function parseJuz(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 30 ? n : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, number: raw } = await params;
  const n = parseJuz(raw);
  if (!n) return {};
  const t = await getTranslations({ locale, namespace: "quran.reader" });
  return { title: `${t("juz", { juz: n })} · ${t("wholeJuz")}` };
}

export default async function JuzReadingPage({ params }: Params) {
  const { locale, number: raw } = await params;
  setRequestLocale(locale);

  const n = parseJuz(raw);
  if (!n) notFound();

  const [t, ayahs] = await Promise.all([getTranslations("quran.reader"), loadJuzAyahs(n)]);

  /* Where this juz begins in the mushaf, so "by page" lands in the right
     place rather than at page one. */
  const firstPage = QURAN_META.pages.find((page) => page.juz === n)?.page ?? 1;

  return (
    <ReadingShell
      title={t("juz", { juz: n })}
      subtitle={`${t("wholeJuz")} · ${t("ayahCount", { count: ayahs.length })}`}
      ayahs={ayahs}
      locale={locale as Locale}
      offlineUnit={`juz-${n}`}
      previous={n > 1 ? { href: `/quran/juz/${n - 1}`, label: t("prevJuz") } : undefined}
      next={n < 30 ? { href: `/quran/juz/${n + 1}`, label: t("nextJuz") } : undefined}
      alsoBy={[
        { href: `/quran/juz/${n}`, label: t("byJuz"), current: true },
        { href: `/quran/${firstPage}`, label: t("byPage") },
      ]}
    />
  );
}
