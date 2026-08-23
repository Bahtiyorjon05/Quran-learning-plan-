/**
 * How firmly a page is held, and when it must be heard again.
 *
 * Spaced repetition was designed for flashcards, where forgetting a card costs
 * one card. Hifz is not like that: a page half-forgotten corrupts the pages
 * around it, and someone who has "finished" thirty juz but cannot recite them
 * has not finished anything. So the classical schedulers are adapted here in
 * three ways.
 *
 *   1. Strength decays on its own. A page nobody has recited for forty days
 *      stops claiming to be memorized, without anything having to run.
 *   2. Lapses bite harder than SM-2 allows. Forgetting is the signal the whole
 *      system exists to catch.
 *   3. A page that lapses twice leaves the monthly rotation and goes back to
 *      the daily track, which is what a teacher would do.
 *
 * Everything here is pure. The database stores the numbers; this decides them.
 */

/** What a recitation was worth, on the SM-2 scale. */
export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

/** Below this a recitation counts as forgotten, not merely laboured. */
export const LAPSE_BELOW: Quality = 3;

/** Two lapses and a page belongs back in the daily track. */
export const LAPSES_BEFORE_RELEARNING = 2;

/** The strength a page is meant to still have when its next review falls due. */
export const TARGET_RETENTION = 0.6;

/** Ease is clamped to this range, matching the database CHECK constraint. */
export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;

/** A page below this is fragile enough to be worth saying so. */
export const FRAGILE_BELOW = 50;

export type UnitState = {
  /** 0–100. What the page is worth right now, before decay is applied. */
  strength: number;
  ease: number;
  reps: number;
  lapses: number;
  /** Days until the next review, as decided at the last one. */
  intervalDays: number;
};

export const FRESH: UnitState = {
  strength: 0,
  ease: 2.5,
  reps: 0,
  lapses: 0,
  intervalDays: 0,
};

/**
 * How long strength takes to halve.
 *
 * Tied to the interval rather than fixed: a page reviewed monthly is held
 * differently from one learned yesterday, and the same decay curve for both
 * would be wrong for one of them. The constant is chosen so that a page reaches
 * exactly {@link TARGET_RETENTION} of its strength on the day it comes due —
 * the schedule and the decay agree by construction instead of by coincidence.
 *
 * The floor keeps a page learned this morning from evaporating by evening.
 */
export function halfLifeDays(intervalDays: number): number {
  const ratio = Math.log(TARGET_RETENTION) / Math.log(0.5); // ≈ 0.737
  return Math.max(3, intervalDays / ratio);
}

/**
 * What a page is worth today, given when it was last recited.
 *
 * Never rounds up: a page is never stronger than it was left.
 */
export function decayedStrength(unit: UnitState, daysSinceReview: number): number {
  if (unit.strength <= 0) return 0;
  if (daysSinceReview <= 0) return unit.strength;

  const decayed = unit.strength * Math.pow(0.5, daysSinceReview / halfLifeDays(unit.intervalDays));
  return Math.max(0, Math.floor(decayed));
}

/**
 * Turn a drill result into a grade.
 *
 * Accuracy alone would rate someone who needed a hint on every word the same as
 * someone who recited it cleanly, so hints are charged for — at a third of a
 * mistake each, since asking for help is better than guessing wrong and should
 * not be discouraged as strongly.
 */
export function qualityFromDrill(input: {
  total: number;
  correct: number;
  hints: number;
}): Quality {
  if (input.total <= 0) return 0;

  const penalty = input.total - input.correct + input.hints / 3;
  const score = Math.max(0, 1 - penalty / input.total);

  if (score >= 0.97) return 5;
  if (score >= 0.9) return 4;
  if (score >= 0.75) return 3;
  if (score >= 0.5) return 2;
  if (score > 0) return 1;
  return 0;
}

export type ReviewOutcome = UnitState & {
  /** Whether this recitation counted as forgetting. */
  lapsed: boolean;
  /** Whether the page should leave the monthly rotation for the daily one. */
  needsRelearning: boolean;
};

/**
 * Apply a recitation.
 *
 * `daysSinceReview` matters because grading a page you last saw this morning
 * says much less than grading one you last saw in spring; strength is decayed
 * to what it honestly was before the new grade moves it.
 */
export function review(unit: UnitState, quality: Quality, daysSinceReview: number): ReviewOutcome {
  const current = decayedStrength(unit, daysSinceReview);
  const lapsed = quality < LAPSE_BELOW;

  if (lapsed) {
    const lapses = unit.lapses + 1;
    return {
      /* Halved, not zeroed. Someone who stumbled through a page still knows
         more of it than someone who has never seen it, and telling them
         otherwise is both false and discouraging. */
      strength: Math.floor(current / 2),
      ease: clampEase(unit.ease - 0.2),
      reps: 0,
      lapses,
      intervalDays: 1,
      lapsed: true,
      needsRelearning: lapses >= LAPSES_BEFORE_RELEARNING,
    };
  }

  const reps = unit.reps + 1;

  /* SM-2's ease adjustment. A 5 nudges ease up, a 3 pulls it down, a 4 leaves
     it almost where it was. */
  const ease = clampEase(unit.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  const intervalDays =
    reps === 1 ? 1 : reps === 2 ? 6 : Math.min(180, Math.max(1, unit.intervalDays * ease));

  /* Strength climbs toward the grade's ceiling rather than jumping to it: three
     clean recitations should be worth more than one, and a single good day
     should not certify a page as solid. */
  const ceiling = quality === 5 ? 100 : quality === 4 ? 88 : 72;
  const strength = Math.min(100, Math.round(current + (ceiling - current) * 0.45));

  return {
    strength: Math.max(strength, current),
    ease,
    reps,
    lapses: unit.lapses,
    intervalDays,
    lapsed: false,
    /* Lapses are not forgiven by one good day, but they stop forcing the daily
       track once the page has been held three times running. */
    needsRelearning: unit.lapses >= LAPSES_BEFORE_RELEARNING && reps < 3,
  };
}

function clampEase(ease: number): number {
  return Math.min(MAX_EASE, Math.max(MIN_EASE, Math.round(ease * 100) / 100));
}

/**
 * Which pages most need to be heard, weakest first.
 *
 * Sorts by strength as it is *today* rather than as it was left, which is the
 * whole reason decay is modelled: a page recited to 90 in spring is weaker now
 * than one recited to 70 last week, and a plain strength sort would get that
 * backwards.
 */
export function weakestFirst<T extends { unit: UnitState; daysSinceReview: number; page: number }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => {
    const left = decayedStrength(a.unit, a.daysSinceReview);
    const right = decayedStrength(b.unit, b.daysSinceReview);
    if (left !== right) return left - right;
    if (a.daysSinceReview !== b.daysSinceReview) return b.daysSinceReview - a.daysSinceReview;
    return a.page - b.page;
  });
}
