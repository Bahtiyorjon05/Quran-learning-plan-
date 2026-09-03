"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Search } from "lucide-react";

import { Link } from "@/i18n/navigation";
import type { LocalisedSurah } from "@/data/quran/loader";
import { cn } from "@/lib/utils";

/**
 * Browsing the mushaf, two ways.
 *
 * Surahs are what people know by name; juz are what they know by position in a
 * plan. Both land on the same reader, so neither is a dead end.
 *
 * The whole list of 114 is rendered and filtered in the browser rather than
 * searched on the server: it is a few kilobytes of names, and typing that waits
 * for a round trip does not feel like searching.
 */
export function SurahIndex({
  surahs,
  juzStartPages,
  basePath = "/quran",
  continuous = false,
  progress,
}: {
  surahs: LocalisedSurah[];
  juzStartPages: { juz: number; from: number; to: number }[];
  /** "/quran" in public, "/app/quran" for a signed-in reader. */
  basePath?: string;
  /**
   * How much of each surah the reader holds, keyed by surah number.
   *
   * Only the signed-in index has this. A list of 114 identical rows tells
   * somebody a hundred surahs into their hifz nothing about where they are;
   * with it, the ones they carry are visible at a glance and the list becomes
   * a picture of the work rather than a table of contents.
   */
  progress?: Record<number, { held: number; total: number; strength: number }>;
  /**
   * Open a surah or a juz whole, rather than at the page it begins on.
   *
   * True for the public reader, where somebody choosing "Ya-Sin" means the
   * surah and not page 440. The signed-in mushaf stays page-by-page: that is
   * the unit a covenant is measured in and the unit a page gets marked as
   * read, and quietly changing it would break both.
   */
  continuous?: boolean;
}) {
  const t = useTranslations("quran.index");
  const tm = useTranslations("app.mushaf");
  const [tab, setTab] = useState<"surahs" | "juz">("surahs");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return surahs;
    return surahs.filter(
      (s) =>
        s.title.toLowerCase().includes(needle) ||
        s.gloss.toLowerCase().includes(needle) ||
        s.name.includes(needle) ||
        String(s.number) === needle,
    );
  }, [surahs, query]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border border-[var(--line-subtle)] bg-[var(--surface-raised)]/60 p-0.5">
          {(["surahs", "juz"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-current={tab === key ? "true" : undefined}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm transition-colors duration-300",
                tab === key
                  ? "bg-[var(--accent-ground)] text-[var(--on-accent)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-strong)]",
              )}
            >
              {t(key)}
            </button>
          ))}
        </div>

        {tab === "surahs" && (
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="h-10 w-full rounded-full border border-[var(--line-strong)] bg-[var(--surface-inset)]/60 ps-10 pe-4 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
        )}
      </div>

      {tab === "surahs" ? (
        filtered.length === 0 ? (
          <p className="mt-10 text-center text-sm text-[var(--text-muted)]">{t("noResults")}</p>
        ) : (
          <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => {
              const held = progress?.[s.number];
              const share = held && held.total > 0 ? held.held / held.total : 0;
              const whole = share >= 1;
              const some = share > 0 && !whole;

              return (
              <li key={s.number}>
                <Link
                  href={continuous ? `${basePath}/surah/${s.number}` : `${basePath}/${s.startPage}`}
                  className={cn(
                    "group panel panel-interactive flex items-center gap-3.5 rounded-xl p-3.5",
                    /* A surah carried whole is marked on the row itself, not by
                       a badge tucked in a corner — it is the thing worth seeing
                       when the list is scanned. */
                    whole && "!border-[var(--accent)]/45",
                  )}
                >
                  {/* The number in a rotated square, the way a mushaf marks it.
                      Filled once the surah is held entire. */}
                  <span className="relative grid h-9 w-9 shrink-0 place-items-center">
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-0 rotate-45 rounded-[6px] border transition-colors",
                        whole
                          ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_16%,transparent)]"
                          : "border-[var(--line-strong)] group-hover:border-[var(--accent)]/50",
                      )}
                    />
                    {whole ? (
                      <Check
                        className="relative h-3.5 w-3.5 text-[var(--accent-strong)]"
                        strokeWidth={2.4}
                      />
                    ) : (
                      <span className="relative text-xs text-[var(--text-muted)] tabular-nums">
                        {s.number}
                      </span>
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-[var(--text-strong)]">
                        {s.title}
                      </span>
                      <span
                        className="font-arabic shrink-0 text-base text-gold-ink"
                        dir="rtl"
                        aria-hidden
                      >
                        {s.name}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[0.6875rem] text-[var(--text-faint)]">
                        {s.gloss ? `${s.gloss} · ` : ""}
                        {t("ayahs", { count: s.ayahs })}
                      </span>

                      {/* Part of the way through gets a bar, because "some of
                          it" is a quantity; all the way through gets the word,
                          because that is an achievement and not a measurement. */}
                      {whole && (
                        <span className="shrink-0 text-[0.625rem] font-semibold tracking-[0.08em] text-[var(--accent-strong)] uppercase">
                          {tm("memorized")}
                        </span>
                      )}
                      {some && (
                        <span
                          aria-hidden
                          className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--text-strong)_10%,transparent)]"
                        >
                          <span
                            className="block h-full rounded-full bg-[var(--accent)]"
                            style={{ width: `${Math.max(8, share * 100)}%` }}
                          />
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
              );
            })}
          </ul>
        )
      ) : (
        <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {juzStartPages.map((j) => (
            <li key={j.juz}>
              <Link
                href={continuous ? `${basePath}/juz/${j.juz}` : `${basePath}/${j.from}`}
                className="panel panel-interactive flex items-center justify-between gap-3 rounded-xl p-3.5"
              >
                <span className="text-sm font-medium text-[var(--text-strong)]">
                  {t("juzNumber", { number: j.juz })}
                </span>
                <span className="text-[0.6875rem] text-[var(--text-faint)] tabular-nums">
                  {t("pages", { from: j.from, to: j.to })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
