import { describe, expect, it } from "vitest";

import { addDays } from "./date/civil";
import { pageOfLine } from "./quran/mushaf";
import {
  MANZIL_CYCLE_DAYS,
  MANZIL_MAX_PAGES,
  SABQI_DAYS,
  buildDailySheet,
  manzilLoad,
  type MemorizedPage,
} from "./plan/daily";

const TODAY = "2026-08-23";
const START = "2026-01-01";

/** `count` pages, each first memorized `ageDays` ago. */
function held(
  count: number,
  ageDays: number,
  options: { from?: number; strength?: number } = {},
): MemorizedPage[] {
  const from = options.from ?? 1;
  return Array.from({ length: count }, (_, i) => ({
    page: from + i,
    strength: options.strength ?? 70,
    firstMemorizedAt: addDays(TODAY, -ageDays),
    lastReviewedAt: addDays(TODAY, -ageDays),
  }));
}

const base = {
  scope: { kind: "full" } as const,
  startDate: START,
  today: TODAY,
  completedLines: 0,
  dailyLines: 9,
  manzilCycle: "adaptive" as const,
};

describe("the manzil load", () => {
  it("is nothing when nothing is held", () => {
    expect(manzilLoad(0)).toBe(0);
  });

  it("never exceeds what exists", () => {
    /* The traditional rule is a juz a day. Applied literally to someone holding
       six pages it would ask for twenty, which is the kind of advice that makes
       people give up in week one. */
    expect(manzilLoad(6)).toBe(1);
    expect(manzilLoad(6)).toBeLessThanOrEqual(6);
  });

  it("cycles everything within a month", () => {
    for (const holding of [30, 60, 200, 400, 604]) {
      const perDay = manzilLoad(holding);
      expect(perDay * MANZIL_CYCLE_DAYS).toBeGreaterThanOrEqual(
        Math.min(holding, perDay * MANZIL_CYCLE_DAYS),
      );
      // A full khatm of revision fits inside the cycle.
      expect(Math.ceil(holding / perDay)).toBeLessThanOrEqual(MANZIL_CYCLE_DAYS);
    }
  });

  it("caps the daily load however much is held", () => {
    expect(manzilLoad(604)).toBe(MANZIL_MAX_PAGES);
    expect(manzilLoad(10_000)).toBe(MANZIL_MAX_PAGES);
  });
});

describe("the daily sheet", () => {
  it("gives a new portion on the first day and nothing to revise", () => {
    const sheet = buildDailySheet({ ...base, memorized: [] });
    expect(sheet.sabaq).toEqual({ fromLine: 1, toLine: 9 });
    expect(sheet.sabqi).toEqual([]);
    expect(sheet.manzil).toEqual([]);
  });

  it("keeps the last seven days in sabqi and moves the rest to manzil", () => {
    const sheet = buildDailySheet({
      ...base,
      memorized: [
        ...held(3, 1, { from: 10 }), // learned yesterday
        ...held(2, SABQI_DAYS - 1, { from: 20 }), // still inside the window
        ...held(4, SABQI_DAYS, { from: 30 }), // just outside it
        ...held(5, 40, { from: 40 }), // long ago
      ],
    });

    expect(sheet.sabqi).toEqual([10, 11, 12, 20, 21]);
    expect(sheet.sabqi).not.toContain(30);
    expect(sheet.manzil.every((page) => page >= 30)).toBe(true);
  });

  it("counts recency from when a page was learned, not last recited", () => {
    /* A page learned yesterday and recited this morning is still fragile. */
    const sheet = buildDailySheet({
      ...base,
      memorized: [
        { page: 5, strength: 90, firstMemorizedAt: addDays(TODAY, -1), lastReviewedAt: TODAY },
      ],
    });
    expect(sheet.sabqi).toEqual([5]);
    expect(sheet.manzil).toEqual([]);
  });

  it("puts the weakest pages first when the cycle is adaptive", () => {
    const memorized: MemorizedPage[] = [
      { page: 100, strength: 90, firstMemorizedAt: "2026-01-10", lastReviewedAt: "2026-08-20" },
      { page: 200, strength: 20, firstMemorizedAt: "2026-01-10", lastReviewedAt: "2026-08-20" },
      { page: 300, strength: 55, firstMemorizedAt: "2026-01-10", lastReviewedAt: "2026-08-20" },
    ];
    const sheet = buildDailySheet({ ...base, memorized });
    // Only one page is due a day at this size, and it must be the weakest.
    expect(sheet.manzil).toEqual([200]);
  });

  it("breaks ties on strength by whatever has gone longest unrecited", () => {
    const memorized: MemorizedPage[] = [
      { page: 100, strength: 50, firstMemorizedAt: "2026-01-10", lastReviewedAt: "2026-08-22" },
      { page: 200, strength: 50, firstMemorizedAt: "2026-01-10", lastReviewedAt: "2026-05-01" },
    ];
    expect(buildDailySheet({ ...base, memorized }).manzil).toEqual([200]);
  });

  it("treats a page never recited as the most overdue of all", () => {
    const memorized: MemorizedPage[] = [
      { page: 100, strength: 50, firstMemorizedAt: "2026-01-10", lastReviewedAt: "2026-08-22" },
      { page: 200, strength: 50, firstMemorizedAt: "2026-01-10", lastReviewedAt: null },
    ];
    expect(buildDailySheet({ ...base, memorized }).manzil).toEqual([200]);
  });

  it("advances the classic rotation day by day without storing anything", () => {
    const memorized = held(90, 60, { from: 1 });
    const seen = new Set<number>();

    for (let day = 0; day < MANZIL_CYCLE_DAYS; day++) {
      const sheet = buildDailySheet({
        ...base,
        manzilCycle: "classic",
        today: addDays(TODAY, day),
        memorized: memorized.map((p) => ({
          ...p,
          firstMemorizedAt: addDays(addDays(TODAY, day), -60),
        })),
      });
      for (const page of sheet.manzil) seen.add(page);
    }

    /* Thirty days of the rotation should have covered everything held. */
    expect(seen.size).toBe(90);
  });

  it("stops giving new work once the scope is finished", () => {
    const sheet = buildDailySheet({
      ...base,
      completedLines: 9060,
      memorized: held(10, 90),
    });
    expect(sheet.sabaq).toBeNull();
    // Revision continues; that is the whole point.
    expect(sheet.manzil.length).toBeGreaterThan(0);
  });

  it("starts a partial scope at its own first page, not page one", () => {
    const sheet = buildDailySheet({
      ...base,
      scope: { kind: "juzRange", fromJuz: 30, toJuz: 30 },
      memorized: [],
    });
    expect(pageOfLine(sheet.sabaq!.fromLine)).toBe(582);
  });

  it("never asks for a page twice in one day", () => {
    const sheet = buildDailySheet({
      ...base,
      memorized: [...held(4, 2, { from: 50 }), ...held(60, 90, { from: 100 })],
    });
    const overlap = sheet.sabqi.filter((page) => sheet.manzil.includes(page));
    expect(overlap).toEqual([]);
  });
});
