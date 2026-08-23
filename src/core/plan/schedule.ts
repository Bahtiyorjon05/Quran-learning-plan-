import {
  addDays,
  compare,
  diffDays,
  toDayNumber,
  weekday,
  type CivilDate,
} from "@/core/date/civil";
import {
  LINES_PER_PAGE,
  TOTAL_LINES,
  TOTAL_PAGES,
  linesInPages,
  pagesOfJuzRange,
} from "@/core/quran/mushaf";

/* ═══════════════════════════════════════════════════════════════════════════
   STUDY DAYS
   A seven-bit mask, Sunday = bit 0. 127 is every day; 62 is Monday–Friday.
   ═══════════════════════════════════════════════════════════════════════════ */

export const EVERY_DAY = 0b1111111; // 127

export function isStudyDay(date: CivilDate, mask: number): boolean {
  return (mask & (1 << weekday(date))) !== 0;
}

export function studyDaysPerWeek(mask: number): number {
  let count = 0;
  for (let bit = 0; bit < 7; bit++) if (mask & (1 << bit)) count++;
  return count;
}

/**
 * Study days in an inclusive range, in constant time.
 *
 * A plan can run for five years, and this is recomputed on every dashboard
 * render to work out the remaining load — so it counts whole weeks in one
 * multiplication and only walks the leftover days, never the span.
 */
export function countStudyDays(from: CivilDate, to: CivilDate, mask: number): number {
  if (compare(from, to) > 0) return 0;
  if (studyDaysPerWeek(mask) === 0) return 0;

  const days = diffDays(from, to) + 1;
  const wholeWeeks = Math.floor(days / 7);
  let count = wholeWeeks * studyDaysPerWeek(mask);

  const firstWeekday = weekday(from);
  for (let i = 0; i < days % 7; i++) {
    if (mask & (1 << (firstWeekday + i) % 7)) count++;
  }
  return count;
}

/** The first study day on or after a date, or null if the mask is empty. */
export function nextStudyDay(from: CivilDate, mask: number): CivilDate | null {
  if (studyDaysPerWeek(mask) === 0) return null;
  let cursor = from;
  for (let i = 0; i < 7; i++) {
    if (isStudyDay(cursor, mask)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return null;
}

/**
 * The date by which `count` study days have elapsed, counting from `from`.
 * Walks whole weeks first so a five-year plan costs a handful of iterations.
 */
export function dateAfterStudyDays(
  from: CivilDate,
  count: number,
  mask: number,
): CivilDate | null {
  const perWeek = studyDaysPerWeek(mask);
  if (perWeek === 0 || count < 1) return null;

  const wholeWeeks = Math.floor((count - 1) / perWeek);
  let remaining = count - wholeWeeks * perWeek;
  let cursor = addDays(from, wholeWeeks * 7);

  for (let guard = 0; guard < 14; guard++) {
    if (isStudyDay(cursor, mask)) {
      remaining--;
      if (remaining === 0) return cursor;
    }
    cursor = addDays(cursor, 1);
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCOPE
   Everything resolves to a page range, so the rest of the engine never has to
   care which of the three ways it was chosen.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PlanScope =
  | { kind: "full" }
  | { kind: "juzRange"; fromJuz: number; toJuz: number }
  | { kind: "pageRange"; fromPage: number; toPage: number };

export function resolveScope(scope: PlanScope): {
  fromPage: number;
  toPage: number;
  totalLines: number;
} {
  const pages =
    scope.kind === "full"
      ? { from: 1, to: TOTAL_PAGES }
      : scope.kind === "juzRange"
        ? pagesOfJuzRange(scope.fromJuz, scope.toJuz)
        : { from: scope.fromPage, to: scope.toPage };

  return {
    fromPage: pages.from,
    toPage: pages.to,
    totalLines: linesInPages(pages.from, pages.to),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE DIAL, BOTH WAYS
   Someone arrives either with a deadline in mind or with a daily dose in mind.
   Both are the same equation, and the wizard shows each answer as the other is
   adjusted.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PlanShape = {
  startDate: CivilDate;
  endDate: CivilDate;
  totalLines: number;
  /** Lines per study day, rounded up — the number shown to the student. */
  dailyLines: number;
  /** The same in pages, for display only. */
  dailyPages: number;
  studyDays: number;
  calendarDays: number;
};

/** Given an end date, what must be done each study day. */
export function planFromDeadline(input: {
  scope: PlanScope;
  startDate: CivilDate;
  endDate: CivilDate;
  studyDaysMask?: number;
}): PlanShape {
  const mask = input.studyDaysMask ?? EVERY_DAY;
  if (compare(input.endDate, input.startDate) < 0) {
    throw new RangeError("A covenant cannot end before it begins");
  }

  const { totalLines } = resolveScope(input.scope);
  const studyDays = countStudyDays(input.startDate, input.endDate, mask);
  if (studyDays === 0) {
    throw new RangeError("That plan contains no study days");
  }

  const dailyLines = Math.ceil(totalLines / studyDays);
  return {
    startDate: input.startDate,
    endDate: input.endDate,
    totalLines,
    dailyLines,
    dailyPages: dailyLines / LINES_PER_PAGE,
    studyDays,
    calendarDays: diffDays(input.startDate, input.endDate) + 1,
  };
}

/** Given a daily dose, when the covenant ends. */
export function planFromDailyLines(input: {
  scope: PlanScope;
  startDate: CivilDate;
  dailyLines: number;
  studyDaysMask?: number;
}): PlanShape {
  const mask = input.studyDaysMask ?? EVERY_DAY;
  if (input.dailyLines < 1) throw new RangeError("A daily portion must be at least one line");

  const { totalLines } = resolveScope(input.scope);
  const studyDays = Math.ceil(totalLines / input.dailyLines);
  const endDate = dateAfterStudyDays(input.startDate, studyDays, mask);
  if (!endDate) throw new RangeError("That plan contains no study days");

  return {
    startDate: input.startDate,
    endDate,
    totalLines,
    dailyLines: input.dailyLines,
    dailyPages: input.dailyLines / LINES_PER_PAGE,
    studyDays,
    calendarDays: diffDays(input.startDate, endDate) + 1,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   TODAY'S PORTION
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The sabaq for a given day: the next unmemorised stretch, sized to whatever
 * the plan currently requires rather than to what it required at signing.
 *
 * Returns null once the scope is finished — there is nothing new left, and the
 * day becomes revision only.
 */
export function sabaqForDay(input: {
  scope: PlanScope;
  completedLines: number;
  dailyLines: number;
}): { fromLine: number; toLine: number } | null {
  const { fromPage, totalLines } = resolveScope(input.scope);
  if (input.completedLines >= totalLines) return null;

  const scopeFirstLine = (fromPage - 1) * LINES_PER_PAGE + 1;
  const fromLine = scopeFirstLine + input.completedLines;
  const toLine = Math.min(
    fromLine + input.dailyLines - 1,
    scopeFirstLine + totalLines - 1,
  );
  return { fromLine, toLine };
}

/** Sanity ceiling used by the wizard so nobody signs a plan they cannot keep. */
export const MAX_DAILY_LINES = LINES_PER_PAGE * 20; // twenty pages a day
export const ABSOLUTE_TOTAL_LINES = TOTAL_LINES;

export { toDayNumber };
