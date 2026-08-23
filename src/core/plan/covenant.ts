import { compare, type CivilDate } from "@/core/date/civil";

/**
 * The covenant rules, as pure functions.
 *
 * These already exist as triggers in Postgres, and that is where they are
 * actually enforced — a rule that only lives in the UI is not a rule. This
 * mirror exists so the interface can refuse an impossible action *before*
 * asking for it: a date picker that cannot be dragged the wrong way is kinder
 * than one that accepts the drag and then throws an error back.
 *
 * If these two ever disagree, the database is right.
 */

export type AmendmentRefusal =
  | "deadlineExtended"
  | "beforeStart"
  | "scopeGrew"
  | "scopeReductionSpent"
  | "rukhsahExhausted"
  | "planFinished";

export type AmendmentCheck =
  | { allowed: true }
  | { allowed: false; reason: AmendmentRefusal };

const ALLOWED: AmendmentCheck = { allowed: true };

const refuse = (reason: AmendmentRefusal): AmendmentCheck => ({ allowed: false, reason });

export type PlanState = {
  startDate: CivilDate;
  originalEndDate: CivilDate;
  currentEndDate: CivilDate;
  totalLines: number;
  rukhsahBudget: number;
  rukhsahUsed: number;
  scopeReductionsUsed: number;
  status: "active" | "completed" | "abandoned";
};

/** THE RULE. A deadline may sit anywhere at or before where it stands. */
export function canMoveDeadline(plan: PlanState, next: CivilDate): AmendmentCheck {
  if (plan.status !== "active") return refuse("planFinished");
  if (compare(next, plan.currentEndDate) > 0) return refuse("deadlineExtended");
  if (compare(next, plan.startDate) < 0) return refuse("beforeStart");
  return ALLOWED;
}

/** Scope may shrink, exactly once, and never grow. */
export function canReduceScope(plan: PlanState, nextTotalLines: number): AmendmentCheck {
  if (plan.status !== "active") return refuse("planFinished");
  if (nextTotalLines > plan.totalLines) return refuse("scopeGrew");
  if (nextTotalLines === plan.totalLines) return ALLOWED; // a no-op, not a reduction
  if (plan.scopeReductionsUsed >= 1) return refuse("scopeReductionSpent");
  return ALLOWED;
}

/** Rukhsah days are spent one at a time and never refunded. */
export function canSpendRukhsah(plan: PlanState): AmendmentCheck {
  if (plan.status !== "active") return refuse("planFinished");
  if (plan.rukhsahUsed >= plan.rukhsahBudget) return refuse("rukhsahExhausted");
  return ALLOWED;
}

export function rukhsahRemaining(plan: PlanState): number {
  return Math.max(0, plan.rukhsahBudget - plan.rukhsahUsed);
}

/**
 * Postgres speaks in SQLSTATEs; the interface speaks in message keys. This is
 * the seam between them, so a trigger firing still reaches the reader in their
 * own language instead of as a raw database error.
 */
export const SQLSTATE_TO_REFUSAL: Record<string, AmendmentRefusal> = {
  AH001: "deadlineExtended",
  AH002: "beforeStart",
  AH003: "scopeGrew",
  AH004: "scopeReductionSpent",
  AH005: "rukhsahExhausted",
  AH006: "planFinished",
};

export function refusalFromSqlState(code: string | undefined): AmendmentRefusal | null {
  if (!code) return null;
  return SQLSTATE_TO_REFUSAL[code] ?? null;
}
