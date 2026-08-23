import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  addYears,
  diffDays,
  isCivilDate,
  todayIn,
  toIso,
  toDayNumber,
  weekday,
} from "./date/civil";
import {
  JUZ_START_PAGES,
  LINES_PER_PAGE,
  TOTAL_JUZ,
  TOTAL_LINES,
  TOTAL_PAGES,
  describeLineRange,
  firstLineOfPage,
  juzOfPage,
  lastLineOfPage,
  linesInPages,
  pageOfLine,
  pagesInLines,
  pagesOfJuz,
  pagesOfJuzRange,
} from "./quran/mushaf";
import {
  EVERY_DAY,
  countStudyDays,
  dateAfterStudyDays,
  isStudyDay,
  nextStudyDay,
  planFromDailyLines,
  planFromDeadline,
  resolveScope,
  sabaqForDay,
  studyDaysPerWeek,
} from "./plan/schedule";
import { bandFor, computePace, earliestReachableDeadline } from "./plan/pace";
import {
  canMoveDeadline,
  canReduceScope,
  canSpendRukhsah,
  refusalFromSqlState,
  type PlanState,
} from "./plan/covenant";

/* ═══════════════════════════════════════════════════════════════════════════
   CIVIL DATES
   ═══════════════════════════════════════════════════════════════════════════ */

describe("civil dates", () => {
  it("round-trips through day numbers", () => {
    for (const date of ["1970-01-01", "2026-08-23", "2000-02-29", "2100-12-31"]) {
      expect(toIso(toDayNumber(date))).toBe(date);
    }
  });

  it("rejects days that do not exist", () => {
    expect(isCivilDate("2026-02-30")).toBe(false);
    expect(isCivilDate("2026-13-01")).toBe(false);
    expect(isCivilDate("2026-1-1")).toBe(false);
    expect(isCivilDate("2026-02-28")).toBe(true);
    // 2100 is not a leap year; 2000 is.
    expect(isCivilDate("2100-02-29")).toBe(false);
    expect(isCivilDate("2000-02-29")).toBe(true);
  });

  it("knows the days of the week", () => {
    expect(weekday("1970-01-01")).toBe(4); // Thursday
    expect(weekday("2026-08-23")).toBe(0); // Sunday
    expect(weekday("2026-08-24")).toBe(1); // Monday
  });

  it("is immune to daylight saving", () => {
    /* Europe/London springs forward on 2026-03-29. Naive local-time date maths
       loses or gains an hour here and can slide a plan day sideways. */
    expect(diffDays("2026-03-28", "2026-03-30")).toBe(2);
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    // And in the southern-hemisphere direction, too.
    expect(diffDays("2026-10-31", "2026-11-02")).toBe(2);
  });

  it("clamps month arithmetic to real days", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29"); // leap year
    expect(addMonths("2026-08-23", 6)).toBe("2027-02-23");
    expect(addYears("2026-08-23", 3)).toBe("2029-08-23");
    expect(addYears("2024-02-29", 1)).toBe("2025-02-28");
  });

  it("reads today in a named zone", () => {
    /* 23:30 in Tashkent on the 23rd is still the 22nd in UTC. A plan day must
       follow the student, not the server. */
    const instant = new Date("2026-08-23T18:30:00Z");
    expect(todayIn("Asia/Tashkent", instant)).toBe("2026-08-23");
    expect(todayIn("UTC", instant)).toBe("2026-08-23");
    expect(todayIn("America/New_York", instant)).toBe("2026-08-23");

    const lateEvening = new Date("2026-08-23T20:30:00Z"); // 01:30 next day in UZ
    expect(todayIn("Asia/Tashkent", lateEvening)).toBe("2026-08-24");
    expect(todayIn("UTC", lateEvening)).toBe("2026-08-23");
  });

  it("falls back rather than throwing on an unknown zone", () => {
    expect(isCivilDate(todayIn("Not/AZone"))).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   THE MUSHAF
   ═══════════════════════════════════════════════════════════════════════════ */

describe("the mushaf", () => {
  it("has the shape everything else assumes", () => {
    expect(TOTAL_PAGES).toBe(604);
    expect(LINES_PER_PAGE).toBe(15);
    expect(TOTAL_LINES).toBe(9060);
    expect(TOTAL_JUZ).toBe(30);
  });

  it("has juz boundaries that tile the mushaf exactly", () => {
    let covered = 0;
    for (let juz = 1; juz <= TOTAL_JUZ; juz++) {
      const { from, to } = pagesOfJuz(juz);
      expect(to).toBeGreaterThanOrEqual(from);
      covered += to - from + 1;
      if (juz > 1) expect(from).toBe(pagesOfJuz(juz - 1).to + 1);
    }
    expect(covered).toBe(TOTAL_PAGES);

    // The well-known landmarks.
    expect(pagesOfJuz(1)).toEqual({ from: 1, to: 21 });
    expect(pagesOfJuz(30)).toEqual({ from: 582, to: 604 });
    expect(JUZ_START_PAGES[29]).toBe(582);
  });

  it("maps every page to exactly one juz", () => {
    for (let page = 1; page <= TOTAL_PAGES; page++) {
      const juz = juzOfPage(page);
      const { from, to } = pagesOfJuz(juz);
      expect(page).toBeGreaterThanOrEqual(from);
      expect(page).toBeLessThanOrEqual(to);
    }
  });

  it("converts between pages and lines without drift", () => {
    for (let page = 1; page <= TOTAL_PAGES; page++) {
      expect(pageOfLine(firstLineOfPage(page))).toBe(page);
      expect(pageOfLine(lastLineOfPage(page))).toBe(page);
      expect(lastLineOfPage(page) - firstLineOfPage(page) + 1).toBe(LINES_PER_PAGE);
    }
    expect(firstLineOfPage(1)).toBe(1);
    expect(lastLineOfPage(TOTAL_PAGES)).toBe(TOTAL_LINES);
    expect(linesInPages(1, TOTAL_PAGES)).toBe(TOTAL_LINES);
  });

  it("refuses impossible pages and reversed ranges", () => {
    expect(() => juzOfPage(0)).toThrow();
    expect(() => juzOfPage(605)).toThrow();
    expect(() => pageOfLine(0)).toThrow();
    expect(() => pageOfLine(TOTAL_LINES + 1)).toThrow();
    expect(() => linesInPages(10, 5)).toThrow();
    expect(() => pagesOfJuzRange(5, 2)).toThrow();
  });

  it("describes a line range the way a page is spoken about", () => {
    const oneLine = describeLineRange(firstLineOfPage(78), firstLineOfPage(78) + 7);
    expect(oneLine).toMatchObject({ fromPage: 78, toPage: 78, singlePage: true, lines: 8 });
    expect(oneLine.fromLineOnPage).toBe(1);
    expect(oneLine.toLineOnPage).toBe(8);

    const across = describeLineRange(lastLineOfPage(78), firstLineOfPage(80));
    expect(across).toMatchObject({ fromPage: 78, toPage: 80, singlePage: false });
    expect(pagesInLines(lastLineOfPage(78), firstLineOfPage(80))).toEqual([78, 79, 80]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   STUDY DAYS
   ═══════════════════════════════════════════════════════════════════════════ */

describe("study days", () => {
  const WEEKDAYS = 0b0111110; // Monday–Friday

  it("counts every day when the mask is full", () => {
    expect(countStudyDays("2026-01-01", "2026-01-01", EVERY_DAY)).toBe(1);
    expect(countStudyDays("2026-01-01", "2026-01-07", EVERY_DAY)).toBe(7);
    expect(countStudyDays("2026-01-01", "2026-12-31", EVERY_DAY)).toBe(365);
  });

  it("agrees with a brute-force count over a long, awkward span", () => {
    /* The constant-time version is the one that runs on every dashboard render,
       so it is checked against the obvious-but-slow one across every possible
       starting weekday and several masks. */
    const brute = (from: string, to: string, mask: number) => {
      let count = 0;
      for (let d = from; diffDays(d, to) >= 0; d = addDays(d, 1)) {
        if (isStudyDay(d, mask)) count++;
      }
      return count;
    };

    for (const mask of [EVERY_DAY, WEEKDAYS, 0b0000001, 0b1000001, 0b0101010]) {
      for (let offset = 0; offset < 7; offset++) {
        const from = addDays("2026-02-25", offset);
        for (const span of [0, 1, 6, 7, 8, 29, 100, 365]) {
          const to = addDays(from, span);
          expect(countStudyDays(from, to, mask)).toBe(brute(from, to, mask));
        }
      }
    }
  });

  it("counts nothing for an empty mask or a reversed range", () => {
    expect(countStudyDays("2026-01-01", "2026-12-31", 0)).toBe(0);
    expect(countStudyDays("2026-12-31", "2026-01-01", EVERY_DAY)).toBe(0);
    expect(studyDaysPerWeek(EVERY_DAY)).toBe(7);
    expect(studyDaysPerWeek(WEEKDAYS)).toBe(5);
  });

  it("finds the next study day, or reports there is none", () => {
    // 2026-08-23 is a Sunday; a Monday-only mask should skip to the 24th.
    expect(nextStudyDay("2026-08-23", 0b0000010)).toBe("2026-08-24");
    expect(nextStudyDay("2026-08-24", 0b0000010)).toBe("2026-08-24");
    expect(nextStudyDay("2026-08-23", 0)).toBeNull();
  });

  it("walks forward exactly n study days", () => {
    for (const mask of [EVERY_DAY, WEEKDAYS, 0b0000001]) {
      for (const n of [1, 2, 5, 20, 100]) {
        const landing = dateAfterStudyDays("2026-08-23", n, mask)!;
        expect(landing).toBeTruthy();
        expect(isStudyDay(landing, mask)).toBe(true);
        expect(countStudyDays("2026-08-23", landing, mask)).toBe(n);
      }
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   PLAN SHAPE
   ═══════════════════════════════════════════════════════════════════════════ */

describe("planning both ways round the dial", () => {
  it("resolves each kind of scope to pages and lines", () => {
    expect(resolveScope({ kind: "full" })).toEqual({
      fromPage: 1,
      toPage: 604,
      totalLines: 9060,
    });
    expect(resolveScope({ kind: "juzRange", fromJuz: 30, toJuz: 30 })).toEqual({
      fromPage: 582,
      toPage: 604,
      totalLines: 23 * 15,
    });
    expect(resolveScope({ kind: "pageRange", fromPage: 1, toPage: 10 }).totalLines).toBe(150);
  });

  it("gives the numbers the README promises", () => {
    /* The whole Qur'an in three years is about eight lines a day — the figure
       the landing page states, and the reason the unit is the line. */
    const threeYears = planFromDeadline({
      scope: { kind: "full" },
      startDate: "2026-01-01",
      endDate: "2028-12-31",
    });
    expect(threeYears.studyDays).toBe(1096);
    expect(threeYears.dailyLines).toBe(9);
    expect(threeYears.dailyPages).toBeCloseTo(0.6, 1);

    const twoYears = planFromDeadline({
      scope: { kind: "full" },
      startDate: "2026-01-01",
      endDate: "2027-12-31",
    });
    expect(twoYears.dailyLines).toBe(13); // ~0.83 pages a day
  });

  it("is self-inverse: a deadline gives a dose that gives back the deadline", () => {
    for (const endDate of ["2027-06-30", "2028-12-31", "2031-01-01"]) {
      const fromDeadline = planFromDeadline({
        scope: { kind: "full" },
        startDate: "2026-01-01",
        endDate,
      });
      const back = planFromDailyLines({
        scope: { kind: "full" },
        startDate: "2026-01-01",
        dailyLines: fromDeadline.dailyLines,
      });
      /* Rounding the dose up can only finish on or before the original date —
         never after it, which is the direction the covenant forbids. */
      expect(diffDays(back.endDate, endDate)).toBeGreaterThanOrEqual(0);
    }
  });

  it("always rounds the daily portion up, so the deadline is never missed by arithmetic", () => {
    const plan = planFromDeadline({
      scope: { kind: "full" },
      startDate: "2026-01-01",
      endDate: "2028-12-31",
    });
    expect(plan.dailyLines * plan.studyDays).toBeGreaterThanOrEqual(plan.totalLines);
  });

  it("honours rest days by making study days heavier", () => {
    const everyDay = planFromDeadline({
      scope: { kind: "full" },
      startDate: "2026-01-01",
      endDate: "2028-12-31",
    });
    const weekdaysOnly = planFromDeadline({
      scope: { kind: "full" },
      startDate: "2026-01-01",
      endDate: "2028-12-31",
      studyDaysMask: 0b0111110,
    });
    expect(weekdaysOnly.studyDays).toBeLessThan(everyDay.studyDays);
    expect(weekdaysOnly.dailyLines).toBeGreaterThan(everyDay.dailyLines);
  });

  it("refuses a plan that cannot exist", () => {
    expect(() =>
      planFromDeadline({
        scope: { kind: "full" },
        startDate: "2026-06-01",
        endDate: "2026-01-01",
      }),
    ).toThrow();

    expect(() =>
      planFromDeadline({
        scope: { kind: "full" },
        startDate: "2026-01-01",
        endDate: "2028-01-01",
        studyDaysMask: 0,
      }),
    ).toThrow();

    expect(() =>
      planFromDailyLines({ scope: { kind: "full" }, startDate: "2026-01-01", dailyLines: 0 }),
    ).toThrow();
  });
});

describe("today's sabaq", () => {
  it("starts at the first line of the scope and advances with progress", () => {
    const scope = { kind: "full" } as const;
    expect(sabaqForDay({ scope, completedLines: 0, dailyLines: 8 })).toEqual({
      fromLine: 1,
      toLine: 8,
    });
    expect(sabaqForDay({ scope, completedLines: 8, dailyLines: 8 })).toEqual({
      fromLine: 9,
      toLine: 16,
    });
  });

  it("begins where a partial scope begins, not at page one", () => {
    const juzAmma = { kind: "juzRange", fromJuz: 30, toJuz: 30 } as const;
    const first = sabaqForDay({ scope: juzAmma, completedLines: 0, dailyLines: 15 })!;
    expect(pageOfLine(first.fromLine)).toBe(582);
    expect(pageOfLine(first.toLine)).toBe(582);
  });

  it("never runs past the end of the scope", () => {
    const juzAmma = { kind: "juzRange", fromJuz: 30, toJuz: 30 } as const;
    const { totalLines } = resolveScope(juzAmma);
    const last = sabaqForDay({ scope: juzAmma, completedLines: totalLines - 3, dailyLines: 20 })!;
    expect(last.toLine - last.fromLine + 1).toBe(3);
    expect(pageOfLine(last.toLine)).toBe(604);
  });

  it("returns nothing once the scope is finished", () => {
    const scope = { kind: "full" } as const;
    expect(sabaqForDay({ scope, completedLines: TOTAL_LINES, dailyLines: 8 })).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   PACE
   ═══════════════════════════════════════════════════════════════════════════ */

describe("pace pressure", () => {
  const base = {
    totalLines: 9060,
    originalDailyLines: 9,
    endDate: "2028-12-31",
    today: "2026-01-01",
  };

  it("reads as exactly on plan at the moment of signing", () => {
    const pace = computePace({ ...base, completedLines: 0 });
    expect(pace.requiredDailyLines).toBe(9);
    expect(pace.pressure).toBeCloseTo(1, 5);
    expect(pace.band).toBe("onTrack");
    expect(pace.progress).toBe(0);
  });

  it("tightens as days are missed, because time cannot grow", () => {
    const onDay200 = computePace({ ...base, today: "2026-07-19", completedLines: 0 });
    expect(onDay200.pressure).toBeGreaterThan(1);
    expect(onDay200.daysBanked).toBeLessThan(0);
    expect(["tightening", "atRisk", "onTrack"]).toContain(onDay200.band);
  });

  it("banks days when someone runs ahead", () => {
    const ahead = computePace({ ...base, completedLines: 3000 });
    expect(ahead.pressure).toBeLessThan(1);
    expect(ahead.band).toBe("ahead");
    expect(ahead.daysBanked).toBeGreaterThan(0);
  });

  it("puts the bands where the dashboard expects them", () => {
    expect(bandFor(0.5)).toBe("ahead");
    expect(bandFor(1)).toBe("onTrack");
    expect(bandFor(1.2)).toBe("onTrack");
    expect(bandFor(1.21)).toBe("tightening");
    expect(bandFor(1.5)).toBe("tightening");
    expect(bandFor(1.51)).toBe("atRisk");
  });

  it("reports completion rather than a division by zero", () => {
    const done = computePace({ ...base, completedLines: 9060 });
    expect(done.complete).toBe(true);
    expect(done.band).toBe("done");
    expect(done.progress).toBe(1);
    expect(done.requiredDailyLines).toBe(0);
  });

  it("counts today, so the final morning does not claim zero days left", () => {
    const finalDay = computePace({ ...base, today: "2028-12-31", completedLines: 9051 });
    expect(finalDay.remainingStudyDays).toBe(1);
    expect(finalDay.overdue).toBe(false);
    expect(finalDay.requiredDailyLines).toBe(9);
  });

  it("marks a passed deadline as overdue instead of dividing by nothing", () => {
    const late = computePace({ ...base, today: "2029-02-01", completedLines: 9000 });
    expect(late.overdue).toBe(true);
    expect(late.band).toBe("atRisk");
    expect(Number.isFinite(late.requiredDailyLines)).toBe(true);
    expect(late.requiredDailyLines).toBe(60);
  });

  it("offers an earliest deadline that is actually reachable", () => {
    const earliest = earliestReachableDeadline({
      remainingLines: 9060,
      today: "2026-01-01",
      maxDailyLines: 15,
    });
    expect(diffDays("2026-01-01", earliest)).toBe(603); // 604 days at a page a day
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   THE COVENANT
   ═══════════════════════════════════════════════════════════════════════════ */

describe("the covenant, mirrored for the interface", () => {
  const plan: PlanState = {
    startDate: "2026-01-01",
    originalEndDate: "2029-01-01",
    currentEndDate: "2029-01-01",
    totalLines: 9060,
    rukhsahBudget: 12,
    rukhsahUsed: 0,
    scopeReductionsUsed: 0,
    status: "active",
  };

  it("lets a deadline be pulled closer", () => {
    expect(canMoveDeadline(plan, "2028-06-01")).toEqual({ allowed: true });
    expect(canMoveDeadline(plan, plan.currentEndDate)).toEqual({ allowed: true });
  });

  it("refuses an extension, including by a single day", () => {
    expect(canMoveDeadline(plan, "2029-01-02")).toEqual({
      allowed: false,
      reason: "deadlineExtended",
    });
    expect(canMoveDeadline(plan, "2035-01-01").allowed).toBe(false);
  });

  it("refuses a deadline before the plan began", () => {
    expect(canMoveDeadline(plan, "2025-12-31")).toEqual({
      allowed: false,
      reason: "beforeStart",
    });
  });

  it("lets scope shrink exactly once and never grow", () => {
    expect(canReduceScope(plan, 4530)).toEqual({ allowed: true });
    expect(canReduceScope(plan, 12000)).toEqual({ allowed: false, reason: "scopeGrew" });

    const spent = { ...plan, scopeReductionsUsed: 1 };
    expect(canReduceScope(spent, 3000)).toEqual({
      allowed: false,
      reason: "scopeReductionSpent",
    });
    // Setting it to the same value is not a reduction and costs nothing.
    expect(canReduceScope(spent, spent.totalLines)).toEqual({ allowed: true });
  });

  it("spends rukhsah days until the budget is gone", () => {
    expect(canSpendRukhsah(plan)).toEqual({ allowed: true });
    expect(canSpendRukhsah({ ...plan, rukhsahUsed: 12 })).toEqual({
      allowed: false,
      reason: "rukhsahExhausted",
    });
  });

  it("treats a finished plan as final", () => {
    for (const status of ["completed", "abandoned"] as const) {
      const finished = { ...plan, status };
      expect(canMoveDeadline(finished, "2027-01-01").allowed).toBe(false);
      expect(canReduceScope(finished, 100).allowed).toBe(false);
      expect(canSpendRukhsah(finished).allowed).toBe(false);
    }
  });

  it("translates the database's own refusals", () => {
    expect(refusalFromSqlState("AH001")).toBe("deadlineExtended");
    expect(refusalFromSqlState("AH004")).toBe("scopeReductionSpent");
    expect(refusalFromSqlState("23505")).toBeNull();
    expect(refusalFromSqlState(undefined)).toBeNull();
  });
});
