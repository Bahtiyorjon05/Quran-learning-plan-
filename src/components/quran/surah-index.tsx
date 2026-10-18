"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";

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
  /* Phones only: whether the filters are unfolded. From a laptop up they are
     always on show, and this is ignored. */
  const [open, setOpen] = useState(false);
  const results = useRef<HTMLDivElement>(null);

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
  const active =
    Number(status !== "all") + Number(revelation !== "all") + Number(juz !== 0) + Number(order !== "mushaf");

  /* Fold the filters away and bring the list into view — the last step of
     filtering on a phone, where the list is underneath the panel. */
  function showResults() {
    setOpen(false);
    requestAnimationFrame(() =>
      results.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

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
              Every option on screen at once, and every one of them a single
              tap. The first version hid half the choices behind a sideways
              swipe and put juz and order in dropdowns — two taps each, and a
              system picker over the list you were trying to narrow. Here the
              answer to each question is a button you can see; tapping the
              chosen one again lets it go. */}
          <div
            role="group"
            aria-label={t("filters")}
            className="panel mt-4 rounded-2xl p-2 sm:p-3 lg:p-5"
          >
            {/* The fold. One tap opens every filter; what is already applied
                is counted on the bar itself, so a folded panel never hides
                the fact that the list is narrowed. */}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="flex h-12 w-full items-center gap-3 rounded-xl px-3 text-start lg:hidden"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--accent)]">
                <SlidersHorizontal className="h-[1.125rem] w-[1.125rem]" />
              </span>
              <span className="flex-1 text-[1.0625rem] font-semibold text-[var(--text-strong)]">
                {t("filterToggle")}
              </span>
              {active > 0 && (
                <span className="rounded-full bg-[var(--accent-ground)] px-2.5 py-0.5 text-[0.8125rem] font-semibold text-[var(--on-accent)]">
                  {t("activeFilters", { count: active })}
                </span>
              )}
              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-[var(--text-muted)] transition-transform duration-300",
                  open && "rotate-180",
                )}
              />
            </button>

            <div
              className={cn(
                "gap-4 px-1.5 pt-3 pb-1.5 lg:grid lg:grid-cols-2 lg:gap-x-8 lg:p-0",
                open ? "grid" : "hidden",
              )}
            >
              {progress && (
                <Group label={t("statusLabel")} className="lg:col-span-2">
                  <div className="grid grid-cols-2 gap-x-2 gap-y-3 pt-1.5 sm:grid-cols-4">
                    {(
                      [
                        ["all", t("all"), "plain"],
                        ["held", t("statusHeld"), "accent"],
                        ["some", t("statusSome"), "gold"],
                        ["none", t("statusNone"), "plain"],
                      ] as const
                    ).map(([key, label, tone]) => (
                      <Option
                        key={key}
                        on={status === key}
                        tone={tone}
                        onClick={() => setStatus(key)}
                      >
                        <span className="truncate">{label}</span>
                        {/* In the corner rather than beside the word: in
                            Uzbek "Boshlanmagan" needs the whole cell. */}
                        <span
                          className={cn(
                            "absolute -top-2 end-2 rounded-full border px-1.5 text-[0.75rem] leading-[1.15rem] font-semibold tabular-nums",
                            status === key
                              ? "border-transparent bg-[var(--text-strong)] text-[var(--surface-base)]"
                              : "border-[var(--line-subtle)] bg-[var(--surface-raised)] text-[var(--text-muted)]",
                          )}
                        >
                          {counts[key]}
                        </span>
                      </Option>
                    ))}
                  </div>
                </Group>
              )}

              <Group label={t("revelationLabel")}>
                <div className="grid grid-cols-2 gap-2">
                  {(["makkah", "madinah"] as const).map((key) => (
                    <Option
                      key={key}
                      on={revelation === key}
                      onClick={() => setRevelation(revelation === key ? "all" : key)}
                    >
                      {t(key)}
                    </Option>
                  ))}
                </div>
              </Group>

              <Group label={t("orderLabel")}>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["mushaf", t("orderMushaf")],
                      ["short", t("orderShort")],
                      ["long", t("orderLong")],
                    ] as const
                  ).map(([key, label]) => (
                    <Option key={key} on={order === key} onClick={() => setOrder(key)}>
                      <span className="truncate">{label}</span>
                    </Option>
                  ))}
                </div>
              </Group>

              {/* Thirty numbers in rows of ten — the juz as they are counted,
                  one tap each. A juz already held whole is marked, so the grid
                  doubles as a reminder of where you stand. */}
              <Group label={t("juzLabel")} className="lg:col-span-2">
                <div className="grid grid-cols-10 gap-1 sm:gap-1.5 lg:grid-cols-15">
                  {juzStartPages.map((j) => {
                    const p = juzProgress?.[j.juz];
                    const whole = Boolean(p && p.total > 0 && p.held >= p.total);
                    const on = juz === j.juz;
                    return (
                      <button
                        key={j.juz}
                        type="button"
                        onClick={() => setJuz(on ? 0 : j.juz)}
                        aria-pressed={on}
                        aria-label={t("inJuz", { number: j.juz })}
                        className={cn(
                          "grid h-10 min-w-0 place-items-center rounded-lg border text-[0.9375rem] font-medium tabular-nums transition-[background-color,border-color,color] duration-150",
                          on
                            ? "border-transparent bg-[var(--accent-ground)] text-[var(--on-accent)]"
                            : whole
                              ? "border-[var(--accent)]/45 bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-[var(--accent-strong)]"
                              : "border-[var(--line-subtle)] bg-[var(--surface-raised)]/40 text-[var(--text-default)] hover:border-[var(--accent)]/50",
                        )}
                      >
                        {j.juz}
                      </button>
                    );
                  })}
                </div>
              </Group>

              {/* The way out of the fold: the count it will show, and a tap
                  that closes the panel and goes to it. */}
              <button
                type="button"
                onClick={showResults}
                className="mt-1 flex h-12 items-center justify-center rounded-xl bg-[var(--accent-ground)] text-[1rem] font-semibold text-[var(--on-accent)] shadow-[0_12px_28px_-16px_color-mix(in_oklab,var(--accent)_80%,transparent)] lg:hidden"
              >
                {t("showResults", { count: filtered.length })}
              </button>
            </div>
          </div>

          <div ref={results} className="mt-4 flex scroll-mt-24 items-center justify-between gap-3 px-1">
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

/** A labelled set of answers to one question. */
function Group({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <p className="mb-2 px-0.5 text-[0.8125rem] font-semibold tracking-[0.08em] text-[var(--text-faint)] uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

/** One answer: a button the width of its cell, pressed or not. */
function Option({
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
        "relative flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-2.5 text-[0.9375rem] font-medium transition-[background-color,border-color,color] duration-150",
        on
          ? tone === "gold"
            ? "border-transparent bg-[var(--gold)] text-[#1b1406]"
            : "border-transparent bg-[var(--accent-ground)] text-[var(--on-accent)]"
          : "border-[var(--line-subtle)] bg-[var(--surface-raised)]/40 text-[var(--text-default)] hover:border-[var(--accent)]/50 hover:text-[var(--text-strong)]",
      )}
    >
      {children}
    </button>
  );
}
