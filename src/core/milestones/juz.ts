import "server-only";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { juzMilestones, memorizationUnits } from "@/db/schema";
import { QURAN_META } from "@/data/quran/loader";

/**
 * A juz carried whole.
 *
 * The first unit of hifz that feels like an achievement, and the one everybody
 * already counts in — nobody says "I have four hundred and twelve pages".
 *
 * Recorded rather than derived, for two reasons. The date it happened is a
 * fact about someone's life and should survive a page being unmarked later by
 * accident. And the moment can only be *shown* once if there is somewhere to
 * write down that it has been shown; otherwise every visit to the dashboard
 * would throw confetti at a juz finished last March.
 *
 * Nothing is ever taken away. Unmarking a page does not un-finish a juz — the
 * record says what was true on that day, and reaching for it again is the
 * ordinary work of revision, not a demotion.
 */

/** Every page of every juz, once, from the mushaf index. */
const PAGES_BY_JUZ = (() => {
  const map = new Map<number, number[]>();
  for (const page of QURAN_META.pages) {
    const list = map.get(page.juz);
    if (list) list.push(page.page);
    else map.set(page.juz, [page.page]);
  }
  return map;
})();

export type NewMilestone = { juz: number; total: number };

/**
 * Look for juz that have just been completed, and write down any that have.
 *
 * Called after a page is marked. Cheap enough to run every time: one query for
 * the pages held, one insert for anything new.
 *
 * A page held only for some of the surahs sitting on it does not count — the
 * juz is not carried until every page of it is carried whole.
 */
export async function recordJuzMilestones(userId: string): Promise<NewMilestone[]> {
  const held = await db
    .select({ page: memorizationUnits.page })
    .from(memorizationUnits)
    .where(
      and(
        eq(memorizationUnits.userId, userId),
        eq(memorizationUnits.state, "memorized"),
        /* Whole pages only. */
        isNull(memorizationUnits.surahs),
      ),
    );

  const pages = new Set(held.map((h) => h.page));
  const complete: number[] = [];
  for (const [juz, list] of PAGES_BY_JUZ) {
    if (list.every((page) => pages.has(page))) complete.push(juz);
  }
  if (complete.length === 0) return [];

  const already = await db
    .select({ juz: juzMilestones.juz })
    .from(juzMilestones)
    .where(and(eq(juzMilestones.userId, userId), inArray(juzMilestones.juz, complete)));

  const known = new Set(already.map((row) => row.juz));
  const fresh = complete.filter((juz) => !known.has(juz));
  if (fresh.length === 0) return [];

  await db
    .insert(juzMilestones)
    .values(fresh.map((juz) => ({ userId, juz })))
    .onConflictDoNothing();

  const total = known.size + fresh.length;
  return fresh.map((juz) => ({ juz, total }));
}

export type JuzProgress = {
  /** Every juz held, in order. */
  held: number[];
  /** Anything finished but never celebrated. */
  unseen: number[];
};

export async function juzProgress(userId: string): Promise<JuzProgress> {
  const rows = await db
    .select({ juz: juzMilestones.juz, seenAt: juzMilestones.seenAt })
    .from(juzMilestones)
    .where(eq(juzMilestones.userId, userId))
    .orderBy(juzMilestones.juz);

  return {
    held: rows.map((row) => row.juz),
    unseen: rows.filter((row) => row.seenAt === null).map((row) => row.juz),
  };
}

/** The celebration has been shown; do not show it again. */
export async function markJuzSeen(userId: string, juz: number[]): Promise<void> {
  if (juz.length === 0) return;
  await db
    .update(juzMilestones)
    .set({ seenAt: sql`now()` })
    .where(and(eq(juzMilestones.userId, userId), inArray(juzMilestones.juz, juz)));
}

/**
 * The tiers worth naming. One is the first, thirty is the whole Qur'an, and
 * the ones between are where people stop and take stock.
 */
export const JUZ_TIERS = [1, 5, 10, 20, 30] as const;

export function tierFor(total: number): number | null {
  return JUZ_TIERS.includes(total as (typeof JUZ_TIERS)[number]) ? total : null;
}
