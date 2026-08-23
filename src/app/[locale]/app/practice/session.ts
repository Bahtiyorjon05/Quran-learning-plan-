import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { memorizationUnits, profiles } from "@/db/schema";
import { todayIn } from "@/core/date/civil";
import { juzOfPage } from "@/core/quran/mushaf";
import { decayedStrength, FRAGILE_BELOW, weakestFirst, type UnitState } from "@/core/srs/strength";
import { availableModes, generateDrill, type GenerateInput } from "@/core/drill/generate";
import { seedFrom } from "@/core/drill/random";
import type { Drill, DrillMode } from "@/core/drill/types";
import { confusableOnPage, loadPage, pageMeta, surah as surahMeta } from "@/data/quran/loader";

/**
 * Deciding what to practise, and building it.
 *
 * The drill itself is never stored. It is regenerated from its seed when the
 * answers come back, which means a session costs one row at the end instead of
 * a row per question, and a drill can be replayed exactly in a test from four
 * numbers.
 */

export type PracticePage = {
  page: number;
  juz: number;
  surahNames: string[];
  /** Strength as it is today, after decay. */
  strength: number;
  daysSinceReview: number;
  fragile: boolean;
};

/** Pages held by this user, weakest first. */
export async function practicablePages(userId: string): Promise<PracticePage[]> {
  const [profile] = await db
    .select({ timeZone: profiles.timeZone })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  const today = todayIn(profile?.timeZone ?? "Asia/Tashkent");

  const rows = await db
    .select({
      page: memorizationUnits.page,
      strength: memorizationUnits.strength,
      ease: memorizationUnits.ease,
      reps: memorizationUnits.reps,
      lapses: memorizationUnits.lapses,
      intervalDays: memorizationUnits.intervalDays,
      lastReviewedAt: memorizationUnits.lastReviewedAt,
    })
    .from(memorizationUnits)
    .where(and(eq(memorizationUnits.userId, userId), eq(memorizationUnits.state, "memorized")));

  const items = rows.map((row) => {
    const unit: UnitState = {
      strength: row.strength,
      ease: row.ease,
      reps: row.reps,
      lapses: row.lapses,
      intervalDays: row.intervalDays,
    };
    const daysSinceReview = row.lastReviewedAt
      ? Math.max(0, daysBetween(row.lastReviewedAt, today))
      : 0;

    return { page: row.page, unit, daysSinceReview };
  });

  return weakestFirst(items).map((item) => {
    const strength = decayedStrength(item.unit, item.daysSinceReview);
    return {
      page: item.page,
      juz: juzOfPage(item.page),
      surahNames: pageMeta(item.page).surahs.map((n) => surahMeta(n).latin),
      strength,
      daysSinceReview: item.daysSinceReview,
      fragile: strength < FRAGILE_BELOW,
    };
  });
}

/** Days between a stored timestamp and a civil date, in whole days. */
function daysBetween(at: Date, today: string): number {
  const then = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  const [y, m, d] = today.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - then) / 86_400_000);
}

export type BuiltSession = {
  drill: Drill;
  seed: number;
  level: number;
  modes: DrillMode[];
  page: number;
  /** Surah names for every ayah the drill can name, for the duel's choices. */
  names: Record<number, string>;
};

/**
 * Build a drill for a page.
 *
 * The seed is derived from who is practising, what, how, and when — so
 * reloading the page gives the same drill rather than a new one every render,
 * while tomorrow's is different. `nonce` lets "try another" produce a fresh
 * drill without changing anything else.
 */
export async function buildSession(input: {
  userId: string;
  page: number;
  mode?: DrillMode;
  level?: number;
  nonce?: string;
}): Promise<BuiltSession | null> {
  const { meta, ayahs } = await loadPage(input.page);
  if (ayahs.length === 0) return null;

  const confusable = await confusableOnPage(ayahs);

  const generateInput: GenerateInput = {
    page: input.page,
    ayahs: ayahs.map((a) => ({ k: a.k, s: a.s, a: a.a, p: a.p, t: a.t })),
    confusable,
    level: input.level ?? 0,
    seed: 0,
  };

  const modes = availableModes(generateInput);
  if (modes.length === 0) return null;

  const mode = input.mode && modes.includes(input.mode) ? input.mode : modes[0];

  const seed = seedFrom(
    `${input.userId}:${input.page}:${mode}:${input.level ?? 0}:${input.nonce ?? ""}`,
  );

  const drill = generateDrill(mode, { ...generateInput, seed });

  /* Surah names for every ayah the drill can mention — including confusable
     partners, which usually live in another surah entirely. The duel offers
     references as choices, so without these it would show bare numbers. */
  const names: Record<number, string> = {};
  for (const number of new Set([
    ...meta.surahs,
    ...ayahs.map((a) => a.s),
    ...Object.values(confusable).flatMap((list) => list.map((c) => c.s)),
  ])) {
    names[number] = surahMeta(number).latin;
  }

  return { drill, seed, level: input.level ?? 0, modes, page: input.page, names };
}

/**
 * Rebuild a drill exactly as it was shown.
 *
 * Called when answers arrive. If this ever disagreed with what the reciter saw,
 * every mark would be wrong — which is why the generators are pure and the seed
 * carries everything.
 */
export async function rebuildDrill(input: {
  userId: string;
  page: number;
  mode: DrillMode;
  level: number;
  nonce: string;
}): Promise<Drill | null> {
  const { ayahs } = await loadPage(input.page);
  if (ayahs.length === 0) return null;

  const seed = seedFrom(
    `${input.userId}:${input.page}:${input.mode}:${input.level}:${input.nonce}`,
  );

  return generateDrill(input.mode, {
    page: input.page,
    ayahs: ayahs.map((a) => ({ k: a.k, s: a.s, a: a.a, p: a.p, t: a.t })),
    confusable: await confusableOnPage(ayahs),
    level: input.level,
    seed,
  });
}

export { FRAGILE_BELOW };

/** How many pages to offer on the practice index before it becomes a wall. */
export const PRACTICE_SHORTLIST = 12;

/**
 * Whether this page is one the reciter has actually memorized.
 *
 * Only a held page can be scored — practising anything else is welcome, but it
 * moves no strength, and being told that at the end of ten questions rather
 * than before the first is the kind of thing that makes people stop trusting a
 * tool.
 */
export async function isHeld(userId: string, page: number): Promise<boolean> {
  const [row] = await db
    .select({ page: memorizationUnits.page })
    .from(memorizationUnits)
    .where(
      and(
        eq(memorizationUnits.userId, userId),
        eq(memorizationUnits.page, page),
        eq(memorizationUnits.state, "memorized"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** A count of everything held, for the empty state and the header. */
export async function heldPageCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ pages: sql<number>`count(*)::int` })
    .from(memorizationUnits)
    .where(and(eq(memorizationUnits.userId, userId), eq(memorizationUnits.state, "memorized")));
  return row?.pages ?? 0;
}
