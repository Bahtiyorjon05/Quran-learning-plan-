import type { Quality } from "@/core/srs/strength";

/**
 * The shape of a finished practice session.
 *
 * Kept out of the actions file on purpose: a `"use server"` module may export
 * nothing but async functions, and exporting the idle constant from there is
 * what produced the E352 crash once already.
 */
export type PracticeState =
  | { status: "idle" }
  | { status: "error" }
  /** The page was not held, so there was nothing to grade against. */
  | { status: "notHeld" }
  | {
      status: "ok";
      total: number;
      correct: number;
      hints: number;
      /** Per question, which of its items were wrong. */
      wrongAt: number[][];
      quality: Quality;
      strengthBefore: number;
      strengthAfter: number;
      lapsed: boolean;
      needsRelearning: boolean;
    };

export const PRACTICE_IDLE: PracticeState = { status: "idle" };
