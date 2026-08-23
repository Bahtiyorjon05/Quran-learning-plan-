import { getTranslations } from "next-intl/server";

import { BASMALA, surah as surahMeta, type Ayah } from "@/data/quran/loader";
import { TajweedText } from "./tajweed-text";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/** Ayah numbers are set in Arabic-Indic digits, as they are in the mushaf. */
const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

function arabicNumber(value: number): string {
  return String(value)
    .split("")
    .map((d) => ARABIC_DIGITS[Number(d)] ?? d)
    .join("");
}

/**
 * The end-of-ayah marker: an eight-fold rosette with the number inside, which
 * is what sits between ayahs on a printed page. Drawn rather than typed, so it
 * scales with the Arabic and keeps its shape at any size.
 */
function AyahMarker({ number }: { number: number }) {
  return (
    <span
      className="relative mx-1 inline-grid h-[1.6em] w-[1.6em] shrink-0 place-items-center align-middle"
      aria-hidden
    >
      <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full text-gold-ink/60">
        <g fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M20 2 38 20 20 38 2 20Z" />
          <path d="M7.5 7.5h25v25h-25Z" />
        </g>
      </svg>
      <span className="relative text-[0.5em] leading-none text-gold-ink tabular-nums">
        {arabicNumber(number)}
      </span>
    </span>
  );
}

/** The heading that opens a surah on the page where it begins. */
async function SurahHeading({ number }: { number: number }) {
  const t = await getTranslations("quran.index");
  const info = surahMeta(number);

  return (
    <header className="my-8 first:mt-0">
      <div className="relative overflow-hidden rounded-2xl border border-gold-500/25 bg-[linear-gradient(160deg,color-mix(in_oklab,var(--color-gold-500)_10%,transparent),transparent)] px-6 py-6 text-center">
        <div aria-hidden className="girih pointer-events-none absolute inset-0 opacity-[0.06]" />
        <p className="relative font-arabic text-[1.75rem] leading-tight text-gold-ink" dir="rtl">
          {info.name}
        </p>
        <p className="relative mt-2 text-sm text-[var(--text-strong)]">
          {info.latin} · <span className="text-[var(--text-muted)]">{info.meaning}</span>
        </p>
        <p className="relative mt-1 text-[0.6875rem] tracking-[0.14em] text-[var(--text-faint)] uppercase">
          {info.revelation === "makkah" ? t("makkah") : t("madinah")} ·{" "}
          {t("ayahs", { count: info.ayahs })}
        </p>
      </div>

      {/* At-Tawbah is the one surah that opens without the basmala. */}
      {info.basmala && (
        <p
          dir="rtl"
          lang="ar"
          className="font-arabic mt-6 text-center text-[calc(1.5rem*var(--arabic-scale,1))] leading-[2] text-[var(--text-strong)]"
        >
          {BASMALA}
        </p>
      )}
    </header>
  );
}

/**
 * One page of the mushaf.
 *
 * Rendered entirely on the server: the text and all three translations are four
 * megabytes, and none of it needs to reach the browser for a reader to work.
 * What travels is finished HTML.
 */
export async function PageView({
  ayahs,
  locale,
}: {
  ayahs: Ayah[];
  locale: Locale;
}) {
  const t = await getTranslations("quran.reader");

  return (
    <article className="mx-auto max-w-2xl">
      {ayahs.map((ayah, i) => {
        const opensSurah = ayah.a === 1;
        const translation = ayah[locale];

        return (
          <div key={ayah.k}>
            {opensSurah && <SurahHeading number={ayah.s} />}

            <div
              id={`ayah-${ayah.k}`}
              className={cn(
                "scroll-mt-24 border-b border-[var(--line-subtle)] py-6",
                i === ayahs.length - 1 && "border-b-0",
              )}
            >
              <p
                dir="rtl"
                lang="ar"
                className="font-arabic text-[calc(1.5rem*var(--arabic-scale,1))] leading-[2.1] text-[var(--text-strong)] sm:text-[calc(1.75rem*var(--arabic-scale,1))]"
              >
                <TajweedText text={ayah.t} marked={ayah.tj} />
                <AyahMarker number={ayah.a} />
              </p>

              {ayah.sajda && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gold-500/30 bg-gold-500/10 px-2.5 py-0.5 text-[0.6875rem] text-gold-ink">
                  ۩ {t("sajda")}
                </p>
              )}

              {/* Hidden by a data attribute on <html> rather than by unmounting,
                  so toggling the translation never re-renders the Arabic. */}
              <p
                data-translation
                className="mt-3 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]"
              >
                <span className="me-2 text-xs text-[var(--text-faint)] tabular-nums">
                  {ayah.s}:{ayah.a}
                </span>
                {translation}
              </p>
            </div>
          </div>
        );
      })}
    </article>
  );
}
