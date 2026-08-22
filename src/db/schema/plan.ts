import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

const id = () =>
  uuid()
    .primaryKey()
    .default(sql`uuidv7()`);

const now = () => timestamp({ withTimezone: true }).notNull().defaultNow();

export const planScope = pgEnum("plan_scope", ["full", "juz_range", "surah_set"]);
export const planStatus = pgEnum("plan_status", ["active", "completed", "abandoned"]);
export const dailyUnit = pgEnum("daily_unit", ["lines", "pages", "ayahs"]);
export const manzilCycle = pgEnum("manzil_cycle", ["adaptive", "classic"]);
export const planDayStatus = pgEnum("plan_day_status", [
  "pending",
  "complete",
  "partial",
  "missed",
  "rukhsah",
]);

export const amendmentKind = pgEnum("amendment_kind", [
  "created",
  "shortened",
  "scope_reduced",
  "rukhsah_spent",
  "abandoned",
  "completed",
]);

/* ═══════════════════════════════════════════════════════════════════════════
   PLANS — the covenant
   Every invariant below is also enforced by a trigger (see the covenant
   migration). The CHECK constraints catch bad data; the trigger catches bad
   *transitions*, which is where the one-way rule actually lives.
   ═══════════════════════════════════════════════════════════════════════════ */

export const plans = pgTable(
  "plans",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /* ── What is being memorized ── */
    scope: planScope().notNull().default("full"),
    scopeFromPage: smallint().notNull().default(1),
    scopeToPage: smallint().notNull().default(604),
    scopeSurahs: smallint().array(),

    /* Working unit is lines: 604 pages × 15 lines = 9060, so a three-year plan
       is a clean ~8 lines a day rather than an awkward fraction of a page. */
    totalLines: integer().notNull(),
    completedLines: integer().notNull().default(0),

    /* ── The covenant itself ── */
    niyyah: text(),
    startDate: date({ mode: "string" }).notNull(),
    originalEndDate: date({ mode: "string" }).notNull(),
    currentEndDate: date({ mode: "string" }).notNull(),

    dailyUnit: dailyUnit().notNull().default("lines"),
    /* Bitmask, Sunday = bit 0 … Saturday = bit 6. 127 = every day. */
    studyDaysMask: smallint().notNull().default(127),
    manzilCycle: manzilCycle().notNull().default("adaptive"),

    /* ── The concessions, fixed at creation and never toppable-up ── */
    rukhsahBudget: smallint().notNull().default(12),
    rukhsahUsed: smallint().notNull().default(0),
    scopeReductionsUsed: smallint().notNull().default(0),

    status: planStatus().notNull().default("active"),
    completedAt: timestamp({ withTimezone: true }),
    abandonedAt: timestamp({ withTimezone: true }),

    createdAt: now(),
    updatedAt: now(),
  },
  (t) => [
    /* THE RULE. A plan's deadline may sit anywhere at or before where it began,
       and nowhere after it. */
    check("plans_deadline_never_extended", sql`${t.currentEndDate} <= ${t.originalEndDate}`),
    check("plans_deadline_after_start", sql`${t.currentEndDate} >= ${t.startDate}`),
    check("plans_original_deadline_after_start", sql`${t.originalEndDate} >= ${t.startDate}`),

    check("plans_rukhsah_within_budget", sql`${t.rukhsahUsed} <= ${t.rukhsahBudget}`),
    check("plans_rukhsah_used_non_negative", sql`${t.rukhsahUsed} >= 0`),
    check("plans_rukhsah_budget_range", sql`${t.rukhsahBudget} between 0 and 24`),

    /* Scope may shrink, exactly once. Time may never grow. */
    check("plans_scope_reduced_at_most_once", sql`${t.scopeReductionsUsed} between 0 and 1`),

    check("plans_total_lines_positive", sql`${t.totalLines} > 0`),
    check(
      "plans_completed_lines_in_range",
      sql`${t.completedLines} between 0 and ${t.totalLines}`,
    ),
    check(
      "plans_page_range_valid",
      sql`${t.scopeFromPage} between 1 and 604 and ${t.scopeToPage} between 1 and 604 and ${t.scopeFromPage} <= ${t.scopeToPage}`,
    ),
    check("plans_study_days_mask_range", sql`${t.studyDaysMask} between 1 and 127`),

    /* One live covenant at a time. Finished and abandoned plans stay forever. */
    uniqueIndex("plans_one_active_per_user")
      .on(t.userId)
      .where(sql`status = 'active'`),
    index("plans_user_id_idx").on(t.userId),
  ],
);

/* ═══════════════════════════════════════════════════════════════════════════
   PLAN AMENDMENTS — append-only history
   Rows here are written by a trigger on `plans`, never by application code, so
   there is no path that changes a covenant without leaving a record. UPDATE and
   DELETE are both blocked by a second trigger.
   ═══════════════════════════════════════════════════════════════════════════ */

export const planAmendments = pgTable(
  "plan_amendments",
  {
    id: id(),
    planId: uuid()
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),

    kind: amendmentKind().notNull(),

    oldEndDate: date({ mode: "string" }),
    newEndDate: date({ mode: "string" }),
    oldTotalLines: integer(),
    newTotalLines: integer(),

    reason: text(),
    createdAt: now(),
  },
  (t) => [
    check(
      "plan_amendments_never_extends",
      sql`${t.oldEndDate} is null or ${t.newEndDate} is null or ${t.newEndDate} <= ${t.oldEndDate}`,
    ),
    check(
      "plan_amendments_never_grows_scope",
      sql`${t.oldTotalLines} is null or ${t.newTotalLines} is null or ${t.newTotalLines} <= ${t.oldTotalLines}`,
    ),
    index("plan_amendments_plan_id_created_at_idx").on(t.planId, t.createdAt.desc()),
  ],
);

/* ═══════════════════════════════════════════════════════════════════════════
   PLAN DAYS — the generated daily obligation sheet
   Line numbers are global across the mushaf (1…9060), which keeps the sabaq
   range a pair of integers instead of a page/line tuple.
   ═══════════════════════════════════════════════════════════════════════════ */

export const planDays = pgTable(
  "plan_days",
  {
    id: id(),
    planId: uuid()
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),

    sabaqFromLine: integer(),
    sabaqToLine: integer(),
    sabqiPages: smallint().array(),
    manzilPages: smallint().array(),

    sabaqDone: timestamp({ withTimezone: true }),
    sabqiDone: timestamp({ withTimezone: true }),
    manzilDone: timestamp({ withTimezone: true }),

    status: planDayStatus().notNull().default("pending"),
    completedAt: timestamp({ withTimezone: true }),
    createdAt: now(),
  },
  (t) => [
    uniqueIndex("plan_days_plan_id_date_key").on(t.planId, t.date),
    index("plan_days_plan_id_status_idx").on(t.planId, t.status),
    check(
      "plan_days_sabaq_range_valid",
      sql`(${t.sabaqFromLine} is null and ${t.sabaqToLine} is null) or (${t.sabaqFromLine} >= 1 and ${t.sabaqToLine} >= ${t.sabaqFromLine})`,
    ),
  ],
);

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type PlanAmendment = typeof planAmendments.$inferSelect;
export type PlanDay = typeof planDays.$inferSelect;
