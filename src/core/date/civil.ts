/**
 * Civil dates — a calendar day, with no time and no zone.
 *
 * A plan day is "Tuesday the 3rd" in the student's own timezone, not an
 * instant. Representing that with a JS Date invites the classic bugs: a plan
 * created at 23:00 in Tashkent landing on the previous day in UTC, or a
 * daylight-saving shift silently making one week six days long.
 *
 * So dates are ISO strings, and arithmetic goes through a day number — days
 * since 1970-01-01 — computed with Date.UTC, which has no DST and no local
 * offset. Every function here is pure and total.
 */

export type CivilDate = string; // "YYYY-MM-DD"

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function isCivilDate(value: string): value is CivilDate {
  const match = ISO.exec(value);
  if (!match) return false;
  // Rejects 2026-02-30: round-tripping only survives a real calendar day.
  return toIso(toDayNumber(value)) === value;
}

export function assertCivilDate(value: string): CivilDate {
  if (!isCivilDate(value)) throw new RangeError(`Not a calendar date: ${value}`);
  return value;
}

/** Days since the epoch. Negative for dates before 1970. */
export function toDayNumber(date: CivilDate): number {
  const match = ISO.exec(date);
  if (!match) throw new RangeError(`Not a calendar date: ${date}`);
  const [, y, m, d] = match;
  return Math.round(Date.UTC(Number(y), Number(m) - 1, Number(d)) / MS_PER_DAY);
}

export function toIso(dayNumber: number): CivilDate {
  const date = new Date(dayNumber * MS_PER_DAY);
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: CivilDate, days: number): CivilDate {
  return toIso(toDayNumber(date) + days);
}

export function addMonths(date: CivilDate, months: number): CivilDate {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  /* Clamp to the end of the target month, so 31 January plus one month is
     28 February rather than rolling into March. */
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return toIso(
    Math.round(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, lastDay)) /
        MS_PER_DAY,
    ),
  );
}

export function addYears(date: CivilDate, years: number): CivilDate {
  return addMonths(date, years * 12);
}

/** Whole days from `from` to `to`. Positive when `to` is later. */
export function diffDays(from: CivilDate, to: CivilDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

export function compare(a: CivilDate, b: CivilDate): number {
  return toDayNumber(a) - toDayNumber(b);
}

export function min(a: CivilDate, b: CivilDate): CivilDate {
  return compare(a, b) <= 0 ? a : b;
}

export function max(a: CivilDate, b: CivilDate): CivilDate {
  return compare(a, b) >= 0 ? a : b;
}

/** 0 = Sunday … 6 = Saturday, matching the study-day bitmask. */
export function weekday(date: CivilDate): number {
  // 1970-01-01 was a Thursday (4).
  return (((toDayNumber(date) + 4) % 7) + 7) % 7;
}

/** Today, as a calendar date in a given IANA timezone. */
export function todayIn(timeZone: string, now: Date = new Date()): CivilDate {
  try {
    // "en-CA" formats as YYYY-MM-DD, which is exactly the shape we want.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    // An unknown zone must not take the whole app down over a date.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  }
}
