/**
 * Action state for marking a page.
 *
 * Outside the "use server" file, which may only export async functions.
 */
export type MarkState =
  | { status: "idle" }
  /* `learnt` is the pages that crossed into memory on *this* tap, and only
     those — the insert reports what it actually wrote, so re-ticking a day
     already marked says nothing and the reader is not congratulated twice for
     the same page. */
  | { status: "ok"; memorized: boolean; learnt?: number[] }
  | { status: "error" };

export const MARK_IDLE: MarkState = { status: "idle" };
