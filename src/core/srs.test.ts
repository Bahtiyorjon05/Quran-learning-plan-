import { describe, expect, it } from "vitest";

import {
  FRAGILE_BELOW,
  FRESH,
  LAPSES_BEFORE_RELEARNING,
  MAX_EASE,
  MIN_EASE,
  TARGET_RETENTION,
  decayedStrength,
  halfLifeDays,
  qualityFromDrill,
  review,
  weakestFirst,
  type Quality,
  type UnitState,
} from "./srs/strength";

/** A page held at `strength`, on a `intervalDays`-day interval. */
function held(strength: number, intervalDays: number, over: Partial<UnitState> = {}): UnitState {
  return { ...FRESH, strength, intervalDays, reps: 3, ...over };
}

describe("decay", () => {
  it("leaves a page recited today exactly where it was", () => {
    expect(decayedStrength(held(80, 10), 0)).toBe(80);
  });

  it("never lets a page grow stronger by being ignored", () => {
    const unit = held(80, 10);
    let previous = 80;
    for (let day = 1; day <= 90; day++) {
      const now = decayedStrength(unit, day);
      expect(now).toBeLessThanOrEqual(previous);
      previous = now;
    }
  });

  it("brings a page to the retention target on the day it comes due", () => {
    /* This is the contract between the scheduler and the decay curve: if they
       disagreed, "due" would mean nothing. */
    for (const interval of [6, 15, 30, 60, 120]) {
      const unit = held(100, interval);
      const atDue = decayedStrength(unit, interval);
      expect(atDue).toBeGreaterThanOrEqual(TARGET_RETENTION * 100 - 2);
      expect(atDue).toBeLessThanOrEqual(TARGET_RETENTION * 100 + 2);
    }
  });

  it("holds a monthly page far better than a daily one", () => {
    const daily = decayedStrength(held(90, 1), 14);
    const monthly = decayedStrength(held(90, 30), 14);
    expect(monthly).toBeGreaterThan(daily);
  });

  it("does not evaporate a page learned this morning within the day", () => {
    /* A brand-new page has interval 0; without a floor on the half-life it
       would be worth nothing by the evening. */
    expect(halfLifeDays(0)).toBeGreaterThanOrEqual(3);
    expect(decayedStrength({ ...FRESH, strength: 70, intervalDays: 0 }, 1)).toBeGreaterThan(50);
  });

  it("eventually stops calling a long-abandoned page memorized", () => {
    expect(decayedStrength(held(100, 30), 365)).toBeLessThan(FRAGILE_BELOW);
  });

  it("cannot resurrect a page that was never held", () => {
    expect(decayedStrength(FRESH, 5)).toBe(0);
  });
});

describe("grading a drill", () => {
  it("gives full marks only for a clean recitation", () => {
    expect(qualityFromDrill({ total: 30, correct: 30, hints: 0 })).toBe(5);
    expect(qualityFromDrill({ total: 30, correct: 29, hints: 0 })).toBeLessThan(5);
  });

  it("charges for hints, but less than for being wrong", () => {
    const withHints = qualityFromDrill({ total: 30, correct: 30, hints: 3 });
    const withErrors = qualityFromDrill({ total: 30, correct: 27, hints: 0 });
    expect(withHints).toBeGreaterThanOrEqual(withErrors);
  });

  it("counts a recitation with nothing right as forgotten", () => {
    expect(qualityFromDrill({ total: 20, correct: 0, hints: 0 })).toBe(0);
  });

  it("never grades an empty drill", () => {
    expect(qualityFromDrill({ total: 0, correct: 0, hints: 0 })).toBe(0);
  });

  it("stays inside the scale however bad the input", () => {
    const cases = [
      { total: 5, correct: 99, hints: 0 },
      { total: 5, correct: 0, hints: 99 },
    ];
    for (const c of cases) {
      const q = qualityFromDrill(c);
      expect(q).toBeGreaterThanOrEqual(0);
      expect(q).toBeLessThanOrEqual(5);
    }
  });
});

describe("a review", () => {
  it("schedules the classic 1, 6, then ease-multiplied intervals", () => {
    let unit: UnitState = FRESH;
    unit = review(unit, 5, 0);
    expect(unit.intervalDays).toBe(1);
    unit = review(unit, 5, 1);
    expect(unit.intervalDays).toBe(6);
    unit = review(unit, 5, 6);
    expect(unit.intervalDays).toBeGreaterThan(6);
  });

  it("builds strength over several clean recitations rather than in one", () => {
    /* One good day should not certify a page. */
    const first = review(FRESH, 5, 0);
    expect(first.strength).toBeLessThan(80);

    let unit: UnitState = FRESH;
    for (let i = 0; i < 5; i++) unit = review(unit, 5, 0);
    expect(unit.strength).toBeGreaterThan(90);
  });

  it("never reports a page weaker than it honestly is right now", () => {
    const unit = held(90, 30);
    const after = review(unit, 3, 0);
    expect(after.strength).toBeGreaterThanOrEqual(decayedStrength(unit, 0));
  });

  it("halves rather than zeroes strength on a lapse", () => {
    const unit = held(80, 30);
    const after = review(unit, 1, 0);
    expect(after.lapsed).toBe(true);
    expect(after.strength).toBe(40);
    expect(after.intervalDays).toBe(1);
    expect(after.reps).toBe(0);
  });

  it("sends a page back to the daily track after two lapses", () => {
    let unit: UnitState = held(80, 30);
    const first = review(unit, 1, 0);
    expect(first.needsRelearning).toBe(false);

    unit = first;
    const second = review(unit, 1, 1);
    expect(second.lapses).toBe(LAPSES_BEFORE_RELEARNING);
    expect(second.needsRelearning).toBe(true);
  });

  it("lets a relearned page rejoin the rotation after three clean days", () => {
    let unit: UnitState = { ...FRESH, lapses: 2, strength: 30 };
    for (let i = 0; i < 2; i++) unit = review(unit, 5, 1);
    expect(review(unit, 5, 1).needsRelearning).toBe(false);
  });

  it("grades a page by what it was worth today, not when it was left", () => {
    /* Two identical pages, one recited last week and one last year. The same
       grade must not leave them equally strong. */
    const unit = held(90, 20);
    const recent = review(unit, 4, 3);
    const stale = review(unit, 4, 300);
    expect(recent.strength).toBeGreaterThan(stale.strength);
  });

  it("keeps ease inside the range the database will accept", () => {
    let hard: UnitState = FRESH;
    for (let i = 0; i < 40; i++) hard = review(hard, 0, 1);
    expect(hard.ease).toBeGreaterThanOrEqual(MIN_EASE);

    let easy: UnitState = FRESH;
    for (let i = 0; i < 40; i++) easy = review(easy, 5, 1);
    expect(easy.ease).toBeLessThanOrEqual(MAX_EASE);
  });

  it("never schedules a page beyond half a year", () => {
    let unit: UnitState = FRESH;
    for (let i = 0; i < 30; i++) unit = review(unit, 5, unit.intervalDays);
    expect(unit.intervalDays).toBeLessThanOrEqual(180);
  });

  it("keeps every number the database constrains inside its CHECK", () => {
    let unit: UnitState = FRESH;
    const grades: Quality[] = [5, 2, 4, 0, 3, 5, 1, 4];
    for (let i = 0; i < 200; i++) {
      unit = review(unit, grades[i % grades.length], i % 9);
      expect(unit.strength).toBeGreaterThanOrEqual(0);
      expect(unit.strength).toBeLessThanOrEqual(100);
      expect(unit.ease).toBeGreaterThanOrEqual(1.3);
      expect(unit.ease).toBeLessThanOrEqual(3.0);
      expect(unit.reps).toBeGreaterThanOrEqual(0);
      expect(unit.lapses).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(unit.intervalDays)).toBe(true);
    }
  });
});

describe("choosing what to revise", () => {
  it("puts the page that is weakest today first, not the one left weakest", () => {
    /* Recited to 90 in the spring versus 70 last week: a plain strength sort
       gets this backwards, which is the entire reason decay is modelled. */
    const spring = { page: 100, unit: held(90, 20), daysSinceReview: 200 };
    const lastWeek = { page: 200, unit: held(70, 20), daysSinceReview: 7 };

    expect(weakestFirst([lastWeek, spring])[0].page).toBe(100);
  });

  it("breaks ties on strength by whatever has gone longest unheard", () => {
    const a = { page: 10, unit: held(0, 10), daysSinceReview: 3 };
    const b = { page: 20, unit: held(0, 10), daysSinceReview: 90 };
    expect(weakestFirst([a, b])[0].page).toBe(20);
  });

  it("is stable and does not mutate its input", () => {
    const items = [
      { page: 3, unit: held(50, 10), daysSinceReview: 1 },
      { page: 1, unit: held(50, 10), daysSinceReview: 1 },
      { page: 2, unit: held(50, 10), daysSinceReview: 1 },
    ];
    const copy = [...items];
    expect(weakestFirst(items).map((i) => i.page)).toEqual([1, 2, 3]);
    expect(items).toEqual(copy);
  });
});
