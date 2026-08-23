/**
 * Action state for marking a page.
 *
 * Outside the "use server" file, which may only export async functions.
 */
export type MarkState =
  | { status: "idle" }
  | { status: "ok"; memorized: boolean }
  | { status: "error" };

export const MARK_IDLE: MarkState = { status: "idle" };
