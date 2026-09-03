/**
 * Action state for amending a covenant.
 *
 * Outside the "use server" file, which may only export async functions.
 */
export type AmendState =
  | { status: "idle" }
  | { status: "done" }
  | { status: "error"; reason: "later" | "past" | "spent" | "failed" };

export const AMEND_IDLE: AmendState = { status: "idle" };
