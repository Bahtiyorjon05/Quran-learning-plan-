/**
 * The wizard's action state.
 *
 * Kept out of the "use server" file: such a module may only export async
 * functions, and an object export there stops Next loading it at all — which
 * surfaces only on the first real submission, as digest …@E352.
 */
export type NewPlanReason =
  | "alreadyActive"
  | "invalidScope"
  | "invalidDates"
  | "noStudyDays"
  | "tooFast"
  | "unknown";

export type NewPlanState =
  | { status: "idle" }
  | { status: "error"; reason: NewPlanReason };

export const NEW_PLAN_IDLE: NewPlanState = { status: "idle" };
