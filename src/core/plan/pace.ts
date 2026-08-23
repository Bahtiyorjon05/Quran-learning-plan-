import { addDays, compare, type CivilDate } from "@/core/date/civil";
import { LINES_PER_PAGE } from "@/core/quran/mushaf";
import { countStudyDays, EVERY_DAY } from "./schedule";

/**
 * Pace pressure — what falling behind actually costs.
 *
 * The covenant fixes the deadline, so slipping cannot buy time; it can only
 * make tomorrow heavier. This turns that into one number the dashboard can
 * show honestly:
 *
 *     pressure = required daily lines ÷ the daily lines originally agreed
 *
 * 1.0 means on plan. 1.5 means every remaining day is half as long again as
 * the one signed for. Below 1.0 means days have been banked.
 */

export type PaceBand = "ahead" | "onTrack" | "tightening" | "atRisk" | "done";

export type Pace = {
  band: PaceBand;
  /** requiredDaily ÷ originalDaily. 1 when exactly on plan. */
  pressure: number;
  requiredDailyLines: number;
  requiredDailyPages: number;
  originalDailyLines: number;
  remainingLines: number;
  remainingStudyDays: number;
  /** Fraction of the scope memorised, 0–1. */
  progress: number;
  /**
   * Study days of slack, signed. Positive means that many days could be missed
   * and the covenant still holds; negative means that many must be made up.
   */
  daysBanked: number;
  /** True once every line in scope is memorised. */
  complete: boolean;
  /** True when the deadline has passed with lines outstanding. */
  overdue: boolean;
};

export function bandFor(pressure: number): PaceBand {
  if (pressure < 1) return "ahead";
  if (pressure <= 1.2) return "onTrack";
  if (pressure <= 1.5) return "tightening";
  return "atRisk";
}

export function computePace(input: {
  totalLines: number;
  completedLines: number;
  originalDailyLines: number;
  today: CivilDate;
  endDate: CivilDate;
  studyDaysMask?: number;
}): Pace {
  const mask = input.studyDaysMask ?? EVERY_DAY;
  const completed = Math.max(0, Math.min(input.completedLines, input.totalLines));
  const remainingLines = input.totalLines - completed;
  const progress = input.totalLines === 0 ? 1 : completed / input.totalLines;

  if (remainingLines === 0) {
    return {
      band: "done",
      pressure: 0,
      requiredDailyLines: 0,
      requiredDailyPages: 0,
      originalDailyLines: input.originalDailyLines,
      remainingLines: 0,
      remainingStudyDays: 0,
      progress: 1,
      daysBanked: 0,
      complete: true,
      overdue: false,
    };
  }

  /* Today counts: the day is not over, and a plan that told someone they had
     "0 days left" at breakfast on the final day would be lying to them. */
  const remainingStudyDays = countStudyDays(input.today, input.endDate, mask);
  const overdue = compare(input.today, input.endDate) > 0 || remainingStudyDays === 0;

  const requiredDailyLines = overdue
    ? remainingLines
    : Math.ceil(remainingLines / remainingStudyDays);

  const pressure =
    input.originalDailyLines > 0 ? requiredDailyLines / input.originalDailyLines : 0;

  /* How many study days of slack exist: the days the current pace would need,
     subtracted from the days actually left. */
  const daysNeededAtOriginalPace =
    input.originalDailyLines > 0
      ? Math.ceil(remainingLines / input.originalDailyLines)
      : Number.POSITIVE_INFINITY;

  return {
    band: overdue ? "atRisk" : bandFor(pressure),
    pressure,
    requiredDailyLines,
    requiredDailyPages: requiredDailyLines / LINES_PER_PAGE,
    originalDailyLines: input.originalDailyLines,
    remainingLines,
    remainingStudyDays,
    progress,
    daysBanked: Number.isFinite(daysNeededAtOriginalPace)
      ? remainingStudyDays - daysNeededAtOriginalPace
      : 0,
    complete: false,
    overdue,
  };
}

/**
 * The earliest deadline the covenant could still be pulled to.
 *
 * The wizard offers acceleration, and offering a date that cannot be met would
 * be a trap — so this is bounded by a ceiling on the daily portion rather than
 * by optimism.
 */
export function earliestReachableDeadline(input: {
  remainingLines: number;
  today: CivilDate;
  maxDailyLines: number;
  studyDaysMask?: number;
}): CivilDate {
  const mask = input.studyDaysMask ?? EVERY_DAY;
  const daysNeeded = Math.max(1, Math.ceil(input.remainingLines / input.maxDailyLines));

  /* Walk forward until enough study days have accumulated. Bounded by the
     calendar span a full mushaf at the ceiling pace could ever need. */
  let cursor = input.today;
  for (let guard = 0; guard < 4000; guard++) {
    if (countStudyDays(input.today, cursor, mask) >= daysNeeded) return cursor;
    cursor = addDays(cursor, 1);
  }
  return cursor;
}
