import "server-only";

import { juzOfPage } from "@/core/quran/mushaf";

import meta from "./meta.json";
/* Eighty kilobytes, server-side only, and consulted on every practice session,
   so it is imported outright rather than loaded lazily. */
import confusableTable from "./mutashabihat.json";

/**
 * Access to the Qur'an text.
 *
 * Deliberately server-only. The full text with three translations is four
 * megabytes; sending it to a browser to render a single page would be absurd,
 * so pages are rendered on the server and only the finished HTML travels.
 *
 * The text is split by juz and the map below is written out rather than built
 * from a template string, so the bundler can see each file as its own chunk and
 * load a thirtieth of the book instead of all of it.
 */

export type Ayah = {
  /** "2:255" */
  k: string;
  /** surah number */
  s: number;
  /** ayah number within the surah */
  a: number;
  /** mushaf page */
  p: number;
  /** Uthmani text */
  t: string;
  /** The same text with inline tajweed markup, parsed only when colouring is on. */
  tj: string;
  sajda: boolean;
  uz: string;
  ru: string;
  en: string;
};

type JuzFile = { juz: number; ayahs: Ayah[] };

export type Surah = (typeof meta.surahs)[number];
export type PageMeta = (typeof meta.pages)[number];

export const QURAN_META = meta;
export const SURAHS: readonly Surah[] = meta.surahs;
export const PAGES: readonly PageMeta[] = meta.pages;
export const BASMALA = meta.basmala;
export const TOTAL_PAGES = meta.totals.pages;

const JUZ_FILES: Record<number, () => Promise<JuzFile>> = {
  1: () => import("./juz/1.json").then((m) => m.default as JuzFile),
  2: () => import("./juz/2.json").then((m) => m.default as JuzFile),
  3: () => import("./juz/3.json").then((m) => m.default as JuzFile),
  4: () => import("./juz/4.json").then((m) => m.default as JuzFile),
  5: () => import("./juz/5.json").then((m) => m.default as JuzFile),
  6: () => import("./juz/6.json").then((m) => m.default as JuzFile),
  7: () => import("./juz/7.json").then((m) => m.default as JuzFile),
  8: () => import("./juz/8.json").then((m) => m.default as JuzFile),
  9: () => import("./juz/9.json").then((m) => m.default as JuzFile),
  10: () => import("./juz/10.json").then((m) => m.default as JuzFile),
  11: () => import("./juz/11.json").then((m) => m.default as JuzFile),
  12: () => import("./juz/12.json").then((m) => m.default as JuzFile),
  13: () => import("./juz/13.json").then((m) => m.default as JuzFile),
  14: () => import("./juz/14.json").then((m) => m.default as JuzFile),
  15: () => import("./juz/15.json").then((m) => m.default as JuzFile),
  16: () => import("./juz/16.json").then((m) => m.default as JuzFile),
  17: () => import("./juz/17.json").then((m) => m.default as JuzFile),
  18: () => import("./juz/18.json").then((m) => m.default as JuzFile),
  19: () => import("./juz/19.json").then((m) => m.default as JuzFile),
  20: () => import("./juz/20.json").then((m) => m.default as JuzFile),
  21: () => import("./juz/21.json").then((m) => m.default as JuzFile),
  22: () => import("./juz/22.json").then((m) => m.default as JuzFile),
  23: () => import("./juz/23.json").then((m) => m.default as JuzFile),
  24: () => import("./juz/24.json").then((m) => m.default as JuzFile),
  25: () => import("./juz/25.json").then((m) => m.default as JuzFile),
  26: () => import("./juz/26.json").then((m) => m.default as JuzFile),
  27: () => import("./juz/27.json").then((m) => m.default as JuzFile),
  28: () => import("./juz/28.json").then((m) => m.default as JuzFile),
  29: () => import("./juz/29.json").then((m) => m.default as JuzFile),
  30: () => import("./juz/30.json").then((m) => m.default as JuzFile),
};

/* One juz is loaded per request at most, and the same juz is often asked for
   twice while rendering a page and its neighbours. */
const cache = new Map<number, Promise<JuzFile>>();

export function loadJuz(juz: number): Promise<JuzFile> {
  const loader = JUZ_FILES[juz];
  if (!loader) throw new RangeError(`Juz out of range: ${juz}`);
  let pending = cache.get(juz);
  if (!pending) {
    pending = loader();
    cache.set(juz, pending);
  }
  return pending;
}

export function pageMeta(page: number): PageMeta {
  const found = PAGES[page - 1];
  if (!found || found.page !== page) throw new RangeError(`Page out of range: ${page}`);
  return found;
}

export function surah(number: number): Surah {
  const found = SURAHS[number - 1];
  if (!found || found.number !== number) throw new RangeError(`Surah out of range: ${number}`);
  return found;
}

/**
 * Every ayah on a page, in order.
 *
 * A page can straddle a juz boundary — page 21 ends juz 1 and page 22 begins
 * juz 2 — so both neighbours are consulted when the page sits on the seam.
 */
export async function loadPage(page: number): Promise<{ meta: PageMeta; ayahs: Ayah[] }> {
  const info = pageMeta(page);

  const juzToLoad = new Set([info.juz]);
  if (info.juz > 1) juzToLoad.add(info.juz - 1);
  if (info.juz < 30) juzToLoad.add(info.juz + 1);

  const files = await Promise.all([...juzToLoad].map(loadJuz));
  const ayahs = files
    .flatMap((file) => file.ayahs)
    .filter((ayah) => ayah.p === page)
    .sort((a, b) => a.s - b.s || a.a - b.a);

  return { meta: info, ayahs };
}

/** The first page of a surah, for navigation. */
export function pageOfSurah(number: number): number {
  return surah(number).startPage;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MUTASHABIHAT — the passages that confuse a hafiz
   Precomputed at build time (scripts/build-mutashabihat.ts), because finding
   them means comparing every ayah with every other and that is not a thing to
   do inside a request.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Confusable = {
  k: string;
  s: number;
  a: number;
  p: number;
  /** 0–1. 1 means the two passages are identical once marks are stripped. */
  score: number;
};


const CONFUSABLE: Record<string, Confusable[]> = confusableTable;

/** The passages most easily confused with this one, best match first. */
export function confusableWith(key: string): Confusable[] {
  return CONFUSABLE[key] ?? [];
}

/**
 * Confusable partners for a page, with the partner's own text attached.
 *
 * The drill generator needs the text to build a distractor, and the text lives
 * in whichever juz the partner belongs to — which is rarely the page's own.
 */
export async function confusableOnPage(ayahs: readonly Ayah[]) {
  const table: Record<string, (Confusable & { t: string })[]> = {};

  const wanted = new Map<number, Set<string>>();
  for (const ayah of ayahs) {
    for (const partner of confusableWith(ayah.k)) {
      const juz = juzOfPage(partner.p);
      const set = wanted.get(juz);
      if (set) set.add(partner.k);
      else wanted.set(juz, new Set([partner.k]));
    }
  }

  const texts = new Map<string, string>();
  await Promise.all(
    [...wanted.keys()].map(async (juz) => {
      const file = await loadJuz(juz);
      for (const ayah of file.ayahs) {
        if (wanted.get(juz)!.has(ayah.k)) texts.set(ayah.k, ayah.t);
      }
    }),
  );

  for (const ayah of ayahs) {
    const partners = confusableWith(ayah.k)
      .map((partner) => ({ ...partner, t: texts.get(partner.k) ?? "" }))
      .filter((partner) => partner.t.length > 0);
    if (partners.length > 0) table[ayah.k] = partners;
  }

  return table;
}
