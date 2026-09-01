import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { mistakes } from "@/db/schema";
import { juzOfPage } from "@/core/quran/mushaf";
import { loadJuz, surahTitle, type QuranLocale } from "@/data/quran/loader";

/**
 * The weak spots, gathered.
 *
 * Every drill has been recording exactly which word went wrong, in which ayah,
 * and whether it was forgotten or confused with somewhere else — and until now
 * nothing has ever shown it back. A percentage tells a reciter they are at 68%;
 * this tells them they keep losing the fourth word of 2:255, which is a thing
 * that can be worked on.
 *
 * Only unresolved mistakes count. A word answered correctly since is not a weak
 * spot any more, and a list that never forgives would fill with history until
 * it said nothing.
 */

export type WeakSpot = {
  key: string;
  surah: number;
  ayah: number;
  page: number;
  /** How many times this ayah has gone wrong, unresolved. */
  count: number;
  /** The word indices missed, most recent first. */
  words: number[];
  /** True when the misses were confusions rather than blanks. */
  confusable: boolean;
  lastAt: Date;
  /** The ayah itself, and the surah's name in the reader's language. */
  text: string;
  surahName: string;
};

const LIMIT = 20;

export async function loadWeakSpots(
  userId: string,
  locale: QuranLocale,
): Promise<WeakSpot[]> {
  const rows = await db
    .select({
      surah: mistakes.surah,
      ayah: mistakes.ayah,
      page: mistakes.page,
      count: sql<number>`count(*)::int`,
      /* The distinct words, so "the same word four times" and "four different
         words once each" do not read alike — they are different problems. */
      words: sql<number[]>`
        coalesce(array_agg(distinct ${mistakes.wordIndex})
                 filter (where ${mistakes.wordIndex} is not null), '{}')
      `,
      confusions: sql<number>`count(*) filter (where ${mistakes.kind} = 'mutashabih')::int`,
      lastAt: sql<Date>`max(${mistakes.createdAt})`,
    })
    .from(mistakes)
    .where(and(eq(mistakes.userId, userId), isNull(mistakes.resolvedAt)))
    .groupBy(mistakes.surah, mistakes.ayah, mistakes.page)
    .orderBy(desc(sql`count(*)`), desc(sql`max(${mistakes.createdAt})`))
    .limit(LIMIT);

  if (rows.length === 0) return [];

  /* The text, fetched a juz at a time rather than an ayah at a time: twenty
     weak spots usually sit in two or three juz. */
  const needed = new Map<number, Set<string>>();
  for (const row of rows) {
    const juz = juzOfPage(row.page);
    const key = `${row.surah}:${row.ayah}`;
    const set = needed.get(juz);
    if (set) set.add(key);
    else needed.set(juz, new Set([key]));
  }

  const texts = new Map<string, string>();
  await Promise.all(
    [...needed.keys()].map(async (juz) => {
      const file = await loadJuz(juz);
      for (const ayah of file.ayahs) {
        if (needed.get(juz)!.has(ayah.k)) texts.set(ayah.k, ayah.t);
      }
    }),
  );

  return rows.map((row) => {
    const key = `${row.surah}:${row.ayah}`;
    return {
      key,
      surah: row.surah,
      ayah: row.ayah,
      page: row.page,
      count: Number(row.count),
      words: (row.words ?? []).map(Number).sort((a, b) => a - b),
      confusable: Number(row.confusions) > Number(row.count) / 2,
      lastAt: new Date(row.lastAt),
      text: texts.get(key) ?? "",
      surahName: surahTitle(row.surah, locale),
    };
  });
}

export type MistakeSummary = {
  open: number;
  resolved: number;
  /** Distinct ayahs currently going wrong. */
  ayahs: number;
  /** Pages those ayahs sit on, weakest first, for the practice links. */
  pages: number[];
};

export async function loadSummary(userId: string): Promise<MistakeSummary> {
  const [row] = await db.execute<{
    open: number;
    resolved: number;
    ayahs: number;
  }>(sql`
    select
      count(*) filter (where resolved_at is null)::int as open,
      count(*) filter (where resolved_at is not null)::int as resolved,
      count(distinct (surah, ayah)) filter (where resolved_at is null)::int as ayahs
    from mistakes where user_id = ${userId}
  `).then((r) => r.rows as { open: number; resolved: number; ayahs: number }[]);

  const pages = await db
    .select({ page: mistakes.page, count: sql<number>`count(*)::int` })
    .from(mistakes)
    .where(and(eq(mistakes.userId, userId), isNull(mistakes.resolvedAt)))
    .groupBy(mistakes.page)
    .orderBy(desc(sql`count(*)`))
    .limit(6);

  return {
    open: row?.open ?? 0,
    resolved: row?.resolved ?? 0,
    ayahs: row?.ayahs ?? 0,
    pages: pages.map((p) => p.page),
  };
}
