import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  real,
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

export const unitState = pgEnum("unit_state", ["new", "learning", "memorized"]);
export const reviewType = pgEnum("review_type", ["sabaq", "sabqi", "manzil", "test"]);
export const mistakeKind = pgEnum("mistake_kind", [
  "forgot",
  "swapped",
  "tajweed",
  "mutashabih",
]);

/* ═══════════════════════════════════════════════════════════════════════════
   MEMORIZATION UNITS — one row per page, per user
   `strength` is the number the whole product turns on. It rises with clean
   recitation and decays on its own with time, so a page untouched for forty
   days stops claiming to be memorized. `nextDueAt` is what the manzil cycle
   sorts by.
   ═══════════════════════════════════════════════════════════════════════════ */

export const memorizationUnits = pgTable(
  "memorization_units",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    page: smallint().notNull(),

    state: unitState().notNull().default("new"),
    strength: smallint().notNull().default(0),

    /* SM-2 style, tuned for hifz: lapses bite harder, and two lapses force a
       page back into the sabqi track rather than leaving it in manzil.

       Exact rather than `real`, because float4 cannot hold this column's own
       floor: 1.3 rounds to 1.2999999523162842, so `1.3::real >= 1.3` is false
       and the CHECK below rejected rows the scheduler had legitimately clamped.
       A reciter who kept forgetting a page reached a state where nothing could
       be saved again. See migration 0003. */
    ease: numeric({ precision: 3, scale: 2, mode: "number" }).notNull().default(2.5),
    reps: integer().notNull().default(0),
    lapses: integer().notNull().default(0),
    intervalDays: real().notNull().default(0),

    firstMemorizedAt: timestamp({ withTimezone: true }),
    lastReviewedAt: timestamp({ withTimezone: true }),
    nextDueAt: timestamp({ withTimezone: true }),

    createdAt: now(),
    updatedAt: now(),
  },
  (t) => [
    uniqueIndex("memorization_units_user_page_key").on(t.userId, t.page),
    index("memorization_units_user_due_idx").on(t.userId, t.nextDueAt),
    index("memorization_units_user_strength_idx").on(t.userId, t.strength),
    check("memorization_units_page_range", sql`${t.page} between 1 and 604`),
    check("memorization_units_strength_range", sql`${t.strength} between 0 and 100`),
    check("memorization_units_ease_range", sql`${t.ease} between 1.3 and 3.0`),
    check("memorization_units_counters_non_negative", sql`${t.reps} >= 0 and ${t.lapses} >= 0`),
  ],
);

/* ═══════════════════════════════════════════════════════════════════════════
   REVIEW LOGS — every recitation, so strength is always explainable
   ═══════════════════════════════════════════════════════════════════════════ */

export const reviewLogs = pgTable(
  "review_logs",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    unitId: uuid()
      .notNull()
      .references(() => memorizationUnits.id, { onDelete: "cascade" }),
    page: smallint().notNull(),

    type: reviewType().notNull(),
    quality: smallint().notNull(),
    mistakeCount: integer().notNull().default(0),
    durationSec: integer(),

    strengthBefore: smallint().notNull(),
    strengthAfter: smallint().notNull(),

    createdAt: now(),
  },
  (t) => [
    index("review_logs_user_created_at_idx").on(t.userId, t.createdAt.desc()),
    index("review_logs_unit_id_idx").on(t.unitId),
    check("review_logs_quality_range", sql`${t.quality} between 0 and 5`),
    check("review_logs_mistake_count_non_negative", sql`${t.mistakeCount} >= 0`),
  ],
);

/* ═══════════════════════════════════════════════════════════════════════════
   MISTAKES — recorded at word level, which is what makes weak-spot detection
   and the mutashabihat drills possible later
   ═══════════════════════════════════════════════════════════════════════════ */

export const mistakes = pgTable(
  "mistakes",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    page: smallint().notNull(),
    surah: smallint().notNull(),
    ayah: smallint().notNull(),
    wordIndex: smallint(),

    kind: mistakeKind().notNull(),

    /* When a passage is confused with another, both ends are recorded so the
       pair can become a drill. */
    linkedSurah: smallint(),
    linkedAyah: smallint(),

    note: text(),
    resolvedAt: timestamp({ withTimezone: true }),
    createdAt: now(),
  },
  (t) => [
    index("mistakes_user_created_at_idx").on(t.userId, t.createdAt.desc()),
    index("mistakes_user_page_idx").on(t.userId, t.page),
    check("mistakes_surah_range", sql`${t.surah} between 1 and 114`),
    check("mistakes_ayah_positive", sql`${t.ayah} >= 1`),
    check("mistakes_page_range", sql`${t.page} between 1 and 604`),
  ],
);

export type MemorizationUnit = typeof memorizationUnits.$inferSelect;
export type ReviewLog = typeof reviewLogs.$inferSelect;
export type Mistake = typeof mistakes.$inferSelect;
