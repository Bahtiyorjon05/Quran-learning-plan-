"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDownUp, Layers, Search, X } from "lucide-react";

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
 *
 * The filters are the questions somebody memorising actually asks of the list:
 * what have I got, what is half done, what is left — and, when choosing what
 * to start next, the short Makki surahs first, or whatever sits in the juz
 * they are working through. Every one of them is answered here, instantly,
 * without leaving the page.
 */

type Status = "all" | "held" | "some" | "none";

/* A row of controls: swipes on a phone, with a fade on the trailing edge to say
   so; wraps from a tablet up, where there is room for all of it. */
const ROW =
  "-mx-1 flex items-center gap-2 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] " +
  "[mask-image:linear-gradient(to_right,#000_86%,transparent)] " +
  "sm:flex-wrap sm:overflow-visible sm:[mask-image:none]";
type Revelation = "all" | "makkah" | "madinah";
type Order = "mushaf" | "short" | "long";

export function SurahIndex({
  surahs,
  juzStartPages,
  basePath = "/quran",
  continuous = false,
  progress,
  juzProgress,
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
  /** Whole pages held in each juz, keyed by juz number. Signed-in only. */
  juzProgress?: Record<number, { held: number; total: number }>;
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
  const [status, setStatus] = useState<Status>("all");
  const [revelation, setRevelation] = useState<Revelation>("all");
  const [juz, setJuz] = useState<number>(0);
  const [order, setOrder] = useState<Order>("mushaf");

  /* Where each surah stands, worked out once rather than per filter pass. */
  const standing = useMemo(() => {
    const out: Record<number, Exclude<Status, "all">> = {};
    for (const s of surahs) {
      const p = progress?.[s.number];
      const share = p && p.total > 0 ? p.held / p.total : 0;
      out[s.number] = share >= 1 ? "held" : share > 0 ? "some" : "none";
    }
    return out;
  }, [surahs, progress]);

  /* How many surahs answer each status, so a chip says what it will give you
     before you press it. */
  const counts = useMemo(() => {
    const c = { all: surahs.length, held: 0, some: 0, none: 0 };
    for (const s of surahs) c[standing[s.number]]++;
    return c;
  }, [surahs, standing]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const range = juz ? juzStartPages.find((j) => j.juz === juz) : null;

    const list = surahs.filter((s) => {
      if (
        needle &&
        !(
          s.title.toLowerCase().includes(needle) ||
          s.gloss.toLowerCase().includes(needle) ||
          s.name.includes(needle) ||
          String(s.number) === needle
        )
      ) {
        return false;
      }
      if (status !== "all" && standing[s.number] !== status) return false;
      if (revelation !== "all" && s.revelation !== revelation) return false;
      /* A surah belongs to a juz when any of its pages do: Al-Baqara is in
         the first, second and third. */
      if (range && (s.endPage < range.from || s.startPage > range.to)) return false;
      return true;
    });

    if (order === "short") list.sort((a, b) => a.ayahs - b.ayahs || a.number - b.number);
    if (order === "long") list.sort((a, b) => b.ayahs - a.ayahs || a.number - b.number);
    return list;
  }, [surahs, query, status, revelation, juz, order, juzStartPages, standing]);

  const filtering = status !== "all" || revelation !== "all" || juz !== 0 || order !== "mushaf";

  function clear() {
    setStatus("all");
    setRevelation("all");
    setJuz(0);
    setOrder("mushaf");
    setQuery("");
  }

  return (
    <div>
      {/* ── The two ways in, and the search ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border border-[var(--line-subtle)] bg-[var(--surface-raised)]/60 p-1">
          {(["surahs", "juz"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-current={tab === key ? "true" : undefined}
              className={cn(
                "rounded-full px-5 py-2 text-[0.9375rem] font-medium transition-colors duration-300",
                tab === key
                  ? "bg-[var(--accent-ground)] text-[var(--on-accent)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-strong)]",
              )}
            >
              {t(key)}
            </button>
          ))}
        </div>

        {tab === "surahs" && (
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute start-4 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="h-12 w-full rounded-full border border-[var(--line-strong)] bg-[var(--surface-inset)]/60 ps-11 pe-4 text-[0.9375rem] text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
        )}
      </div>

      {tab === "surahs" ? (
        <>
          {/* ── Filters ──
              Two rows that swipe sideways on a phone and wrap from a tablet
              up. Stacked, they were four rows of chips and most of a phone
              screen before the first surah; the fade on the trailing edge is
              what says there is more to the side. */}
          <div
            role="group"
            aria-label={t("filters")}
            className="panel mt-4 flex flex-col gap-2.5 rounded-2xl p-2.5 sm:gap-3 sm:p-4"
          >
            {/* Where you stand: only where there is something to stand on. */}
            {progress && (
              <div className={ROW}>
                {(
                  [
                    ["all", t("all")],
                    ["held", t("statusHeld")],
                    ["some", t("statusSome")],
                    ["none", t("statusNone")],
                  ] as const
                ).map(([key, label]) => (
                  <Chip
                    key={key}
                    on={status === key}
                    onClick={() => setStatus(key)}
                    tone={key === "held" ? "accent" : key === "some" ? "gold" : "plain"}
                  >
                    {label}
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[0.8125rem] tabular-nums",
                        status === key ? "bg-black/15" : "bg-[var(--surface-inset)]",
                      )}
                    >
                      {counts[key]}
                    </span>
                  </Chip>
                ))}
              </div>
            )}

            <div className={ROW}>
              {/* One control with two answers, either of which can be taken
                  back by tapping it again. A third "all" button read exactly
                  like the "all" in the row above, and two identical words
                  meaning different things is a puzzle, not a filter. */}
              <div className="inline-flex h-10 shrink-0 rounded-full border border-[var(--line-strong)] bg-[var(--surface-raised)]/50 p-1">
                {(
                  [
                    ["makkah", t("makkah")],
                    ["madinah", t("madinah")],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setRevelation(revelation === key ? "all" : key)}
                    aria-pressed={revelation === key}
                    className={cn(
                      "rounded-full px-3.5 text-[0.9375rem] font-medium whitespace-nowrap transition-colors duration-200",
                      revelation === key
                        ? "bg-[var(--accent-ground)] text-[var(--on-accent)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-strong)]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <Select
                icon={<Layers className="h-4 w-4" />}
                label={t("anyJuz")}
                value={String(juz)}
                onChange={(v) => setJuz(Number(v))}
                options={[
                  ["0", t("anyJuz")],
                  ...juzStartPages.map((j) => [String(j.juz), t("inJuz", { number: j.juz })] as [string, string]),
                ]}
              />

              <Select
                icon={<ArrowDownUp className="h-4 w-4" />}
                label={t("sortMushaf")}
                value={order}
                onChange={(v) => setOrder(v as Order)}
                options={[
                  ["mushaf", t("sortMushaf")],
                  ["short", t("sortShort")],
                  ["long", t("sortLong")],
                ]}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 px-1">
            <p className="text-[0.9375rem] text-[var(--text-muted)]" aria-live="polite">
              {t("results", { count: filtered.length })}
            </p>
            {(filtering || query) && (
              <button
                type="button"
                onClick={clear}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.9375rem] font-medium text-[var(--accent-strong)] transition-colors hover:bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]"
              >
                <X className="h-4 w-4" />
                {t("clear")}
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <p className="mt-10 text-center text-[1.0625rem] text-[var(--text-muted)]">{t("noResults")}</p>
          ) : (
            <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((s) => {
                const held = progress?.[s.number];
                const share = held && held.total > 0 ? held.held / held.total : 0;
                const whole = share >= 1;
                const some = share > 0 && !whole;

                return (
                  <li key={s.number} className="min-w-0">
                    <Link
                      href={continuous ? `${basePath}/surah/${s.number}` : `${basePath}/${s.startPage}`}
                      className={cn(
                        "group panel panel-interactive flex items-center gap-4 rounded-2xl p-4 sm:p-5",
                        /* A surah carried whole is marked on the row itself, not
                           by a badge tucked in a corner — it is the thing worth
                           seeing when the list is scanned. */
                        whole && "!border-[var(--accent)]/45",
                      )}
                    >
                      {/* The number in a rotated square, the way a mushaf marks
                          it. Filled once the surah is held entire. */}
                      <span className="relative grid h-12 w-12 shrink-0 place-items-center">
                        <span
                          aria-hidden
                          className={cn(
                            "absolute inset-1 rotate-45 rounded-[7px] border transition-colors",
                            whole
                              ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_16%,transparent)]"
                              : some
                                ? "border-[var(--gold)]/60"
                                : "border-[var(--line-strong)] group-hover:border-[var(--accent)]/50",
                          )}
                        />
                        <span
                          className={cn(
                            "relative text-[0.9375rem] tabular-nums",
                            whole ? "font-semibold text-[var(--accent-strong)]" : "text-[var(--text-muted)]",
                          )}
                        >
                          {s.number}
                        </span>
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[1.0625rem] font-medium text-[var(--text-strong)]">
                            {s.title}
                          </span>
                          <span className="font-arabic shrink-0 text-[1.375rem] leading-none text-gold-ink" dir="rtl" aria-hidden>
                            {s.name}
                          </span>
                        </span>
                        <span className="mt-1 flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-[0.875rem] text-[var(--text-faint)]">
                            {s.gloss ? `${s.gloss} · ` : ""}
                            {t("ayahs", { count: s.ayahs })}
                          </span>

                          {/* Part of the way through gets a bar, because "some
                              of it" is a quantity; all the way through gets the
                              word, because that is an achievement and not a
                              measurement. */}
                          {whole && (
                            <span className="shrink-0 rounded-full bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] px-2 py-0.5 text-[0.75rem] font-semibold tracking-[0.06em] text-[var(--accent-strong)] uppercase">
                              {tm("memorized")}
                            </span>
                          )}
                          {some && (
                            <span
                              aria-hidden
                              className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--text-strong)_10%,transparent)]"
                            >
                              <span
                                className="block h-full rounded-full bg-[var(--gold)]"
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
          )}
        </>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {juzStartPages.map((j) => {
            const p = juzProgress?.[j.juz];
            const share = p && p.total > 0 ? p.held / p.total : 0;
            const whole = share >= 1;

            return (
              <li key={j.juz} className="min-w-0">
                <Link
                  href={continuous ? `${basePath}/juz/${j.juz}` : `${basePath}/${j.from}`}
                  className={cn(
                    "group panel panel-interactive flex flex-col gap-3 rounded-2xl p-4 sm:p-5",
                    whole && "!border-[var(--accent)]/45",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-[1.0625rem] font-medium text-[var(--text-strong)]">
                      {t("juzNumber", { number: j.juz })}
                    </span>
                    <span className="text-[0.875rem] text-[var(--text-faint)] tabular-nums">
                      {t("pages", { from: j.from, to: j.to })}
                    </span>
                  </span>

                  {/* The juz's own share of the work, so this tab is a map of
                      the hifz and not only a list of page numbers. */}
                  {p && (
                    <span className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="h-2 flex-1 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--text-strong)_9%,transparent)]"
                      >
                        <span
                          className={cn(
                            "block h-full rounded-full transition-[width] duration-700",
                            whole ? "bg-[var(--accent)]" : "bg-[var(--gold)]",
                          )}
                          style={{ width: `${share > 0 ? Math.max(4, share * 100) : 0}%` }}
                        />
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-[0.8125rem] tabular-nums",
                          whole ? "font-semibold text-[var(--accent-strong)]" : "text-[var(--text-muted)]",
                        )}
                      >
                        {whole ? t("juzWhole") : t("juzHeld", { held: p.held, total: p.total })}
                      </span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chip({
  on,
  onClick,
  tone = "plain",
  children,
}: {
  on: boolean;
  onClick: () => void;
  tone?: "plain" | "accent" | "gold";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[0.9375rem] font-medium whitespace-nowrap transition-[background-color,border-color,color] duration-200",
        on
          ? tone === "gold"
            ? "border-transparent bg-[var(--gold)] text-[#1b1406]"
            : "border-transparent bg-[var(--accent-ground)] text-[var(--on-accent)]"
          : "border-[var(--line-strong)] bg-[var(--surface-raised)]/50 text-[var(--text-default)] hover:border-[var(--accent)]/50 hover:text-[var(--text-strong)]",
      )}
    >
      {children}
    </button>
  );
}

/**
 * A native select dressed as a chip.
 *
 * Native on purpose: on a phone it opens the system picker, which is the one
 * list of thirty options anybody can actually scroll with a thumb.
 */
function Select({
  icon,
  label,
  value,
  onChange,
  options,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  const active = value !== options[0][0];
  return (
    <label
      className={cn(
        "relative inline-flex h-10 shrink-0 items-center gap-2 rounded-full border ps-3.5 pe-3 text-[0.9375rem] font-medium transition-[background-color,border-color,color] duration-200",
        active
          ? "border-[var(--accent)]/60 bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-[var(--accent-strong)]"
          : "border-[var(--line-strong)] bg-[var(--surface-raised)]/50 text-[var(--text-default)] hover:border-[var(--accent)]/50",
      )}
    >
      <span aria-hidden className="text-current opacity-80">
        {icon}
      </span>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent pe-1 font-medium text-current outline-none [&>option]:bg-[var(--surface-raised)] [&>option]:text-[var(--text-strong)]"
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
