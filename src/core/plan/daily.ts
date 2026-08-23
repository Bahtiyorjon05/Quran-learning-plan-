import { diffDays, type CivilDate } from "@/core/date/civil";
import { sabaqForDay, type PlanScope } from "./schedule";

/**
 * The three obligations of a day.
 *
 * This is the centre of the product. Everything else — the covenant, the pace
 * gauge, the mosaic — exists so that this function can be honest about what
 * today actually requires.
 */

/** How long a page stays in the recent track before it joins the rotation. */
export const SABQI_DAYS = 7;

/**
 * The classical manzil: everything you hold, cycled once a month.
 *
 * A fixed juz a day is the traditional rule and it is wrong for a beginner —
 * someone holding six pages would be told to revise twenty. Scaling the daily
 * load to the size of the hifz keeps the thirty-day cycle while making the
 * first months possible.
 */
export const MANZIL_CYCLE_DAYS = 30;

/**
 * The ceiling on a day's revision: one juz.
 *
 * Twenty looks like the right number and is not — a juz averages 604 ÷ 30 ≈
 * 20.1 pages, so a cap of twenty makes a full mushaf take thirty-one days and
 * quietly breaks the thirty-day cycle this module promises. Twenty-one keeps
 * the promise for someone holding the entire Qur'an.
 */
export const MANZIL_MAX_PAGES = 21;

export type MemorizedPage = {
  page: number;
  strength: number;
  /** When it was first committed to memory. Decides recent versus old. */
  firstMemorizedAt: CivilDate;
  /** When it was last recited. Oldest first within the same strength. */
  lastReviewedAt: CivilDate | null;
};

export type DailySheet = {
  /** Today's new portion, or null once the scope is finished. */
  sabaq: { fromLine: number; toLine: number } | null;
  /** Recently memorized pages, still fragile enough to lose. */
  sabqi: number[];
  /** Older pages due today. */
  manzil: number[];
};

/**
 * How many old pages to revise today.
 *
 * Enough to cycle everything within thirty days, never more than a juz, and
 * never more than exist.
 */
export function manzilLoad(oldPageCount: number): number {
  if (oldPageCount === 0) return 0;
  return Math.min(
    MANZIL_MAX_PAGES,
    oldPageCount,
    Math.max(1, Math.ceil(oldPageCount / MANZIL_CYCLE_DAYS)),
  );
}

/**
 * Which old pages come first.
 *
 * Adaptive puts the weakest at the front, then whatever has gone longest
 * unrecited — the whole reason strength is tracked at all. Classic keeps
 * mushaf order, which is what a teacher following the traditional rotation
 * expects, and stays available as a choice.
 */
function orderForRevision(
  pages: MemorizedPage[],
  cycle: "adaptive" | "classic",
  today: CivilDate,
): MemorizedPage[] {
  const sorted = [...pages];

  if (cycle === "classic") {
    sorted.sort((a, b) => a.page - b.page);
    return sorted;
  }

  sorted.sort((a, b) => {
    if (a.strength !== b.strength) return a.strength - b.strength;

    const aAge = a.lastReviewedAt ? diffDays(a.lastReviewedAt, today) : Number.MAX_SAFE_INTEGER;
    const bAge = b.lastReviewedAt ? diffDays(b.lastReviewedAt, today) : Number.MAX_SAFE_INTEGER;
    if (aAge !== bAge) return bAge - aAge;

    return a.page - b.page;
  });
  return sorted;
}

/**
 * Where the classic rotation has reached.
 *
 * Days since the plan began, modulo the cycle, so the rotation advances on its
 * own without anything needing to be stored between days.
 */
function classicOffset(startDate: CivilDate, today: CivilDate, load: number, total: number) {
  if (total === 0 || load === 0) return 0;
  const day = Math.max(0, diffDays(startDate, today));
  return (day * load) % total;
}

export function buildDailySheet(input: {
  scope: PlanScope;
  startDate: CivilDate;
  today: CivilDate;
  completedLines: number;
  dailyLines: number;
  memorized: MemorizedPage[];
  manzilCycle: "adaptive" | "classic";
}): DailySheet {
  const sabaq = sabaqForDay({
    scope: input.scope,
    completedLines: input.completedLines,
    dailyLines: input.dailyLines,
  });

  /* Recent versus old is decided by when a page was first memorized, not when
     it was last seen — a page learned yesterday belongs in sabqi even if it was
     recited this morning. */
  const recent: MemorizedPage[] = [];
  const older: MemorizedPage[] = [];

  for (const page of input.memorized) {
    const age = diffDays(page.firstMemorizedAt, input.today);
    if (age < SABQI_DAYS) recent.push(page);
    else older.push(page);
  }

  const load = manzilLoad(older.length);
  const ordered = orderForRevision(older, input.manzilCycle, input.today);

  const manzil =
    input.manzilCycle === "classic"
      ? rotate(ordered, classicOffset(input.startDate, input.today, load, ordered.length)).slice(
          0,
          load,
        )
      : ordered.slice(0, load);

  return {
    sabaq,
    sabqi: recent.map((p) => p.page).sort((a, b) => a - b),
    manzil: manzil.map((p) => p.page).sort((a, b) => a - b),
  };
}

function rotate<T>(items: T[], by: number): T[] {
  if (items.length === 0) return items;
  const offset = ((by % items.length) + items.length) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}
