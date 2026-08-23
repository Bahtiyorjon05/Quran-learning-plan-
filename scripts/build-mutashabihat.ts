/**
 * Finds the passages that confuse a hafiz, once, offline.
 *
 * Mutashabihat — near-identical ayahs in different places — are the hardest
 * part of hifz and almost nothing addresses them directly. Locating them means
 * comparing every ayah with every other, which is nineteen million pairs, so it
 * happens here at build time rather than in a request.
 *
 * An inverted index over the rarest word of each ayah does the pruning: two
 * passages cannot be near-identical without sharing their uncommon words.
 *
 * This finds mutashabihat at the level of a whole ayah. Two ayahs that merely
 * share a phrase — 2:25 and 4:57 both speak of gardens beneath which rivers
 * flow, and score 0.48 — are a different and harder problem, and this index
 * does not claim to solve it.
 *
 *   npm run quran:mutashabihat
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { normalizedWords, similarity } from "../src/core/quran/arabic";

const OUT = path.join(process.cwd(), "src/data/quran/mutashabihat.json");

/** Below this two ayahs are merely on the same subject, not confusable. */
const THRESHOLD = 0.6;
/** Very short ayahs share words by accident; huruf muqatta'at especially. */
const MIN_WORDS = 4;
/**
 * How many partners to remember.
 *
 * Three was too few: the closing formula of Ash-Shu'ara repeats eight times, so
 * three neighbours is not enough material for a drill that should not repeat
 * the same pairing every session.
 */
const MAX_PARTNERS = 5;

type Ayah = { k: string; s: number; a: number; p: number; t: string };

type Scored = { k: string; score: number; distance: number };

function loadAyahs(): Ayah[] {
  const all: Ayah[] = [];
  for (let juz = 1; juz <= 30; juz++) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const file = require(`../src/data/quran/juz/${juz}.json`) as { ayahs: Ayah[] };
    all.push(...file.ayahs);
  }
  return all;
}

async function main() {
  const ayahs = loadAyahs();
  console.log(`comparing ${ayahs.length} ayahs`);

  const words = new Map<string, string[]>();
  for (const ayah of ayahs) words.set(ayah.k, normalizedWords(ayah.t));

  /* Document frequency, so each ayah can be indexed under the words least
     likely to appear elsewhere. */
  const frequency = new Map<string, number>();
  for (const list of words.values()) {
    for (const word of new Set(list)) frequency.set(word, (frequency.get(word) ?? 0) + 1);
  }

  const index = new Map<string, string[]>();
  const RARE_PER_AYAH = 4;

  for (const ayah of ayahs) {
    const list = words.get(ayah.k)!;
    if (list.length < MIN_WORDS) continue;

    const rarest = [...new Set(list)]
      .sort((a, b) => (frequency.get(a) ?? 0) - (frequency.get(b) ?? 0))
      .slice(0, RARE_PER_AYAH);

    for (const word of rarest) {
      const bucket = index.get(word);
      if (bucket) bucket.push(ayah.k);
      else index.set(word, [ayah.k]);
    }
  }

  const byKey = new Map(ayahs.map((a) => [a.k, a]));
  /* Position in the mushaf, so ties can be broken by nearness. */
  const position = new Map(ayahs.map((a, i) => [a.k, i]));
  const pairs = new Map<string, { k: string; score: number }[]>();
  let compared = 0;

  for (const ayah of ayahs) {
    const mine = words.get(ayah.k)!;
    if (mine.length < MIN_WORDS) continue;

    const candidates = new Set<string>();
    for (const word of new Set(mine)) {
      const bucket = index.get(word);
      /* A word in half the Qur'an prunes nothing and costs everything. */
      if (!bucket || bucket.length > 400) continue;
      for (const key of bucket) if (key !== ayah.k) candidates.add(key);
    }

    const scored: Scored[] = [];
    for (const key of candidates) {
      const other = words.get(key)!;
      if (other.length < MIN_WORDS) continue;

      /* Length alone rules most pairs out before any comparison. */
      const ratio = Math.min(mine.length, other.length) / Math.max(mine.length, other.length);
      if (ratio < THRESHOLD) continue;

      compared++;
      const score = similarity(mine, other);
      if (score >= THRESHOLD) {
        scored.push({
          k: key,
          score,
          distance: Math.abs(position.get(key)! - position.get(ayah.k)!),
        });
      }
    }

    if (scored.length === 0) continue;
    /* Best match first, then nearest in the mushaf. Sorting ties by key string
       put "26:104" ahead of "26:68" and truncated away the neighbour a reciter
       is most likely to confuse. */
    scored.sort((a, b) => b.score - a.score || a.distance - b.distance);
    pairs.set(ayah.k, scored.slice(0, MAX_PARTNERS));
  }

  console.log(`  ${compared.toLocaleString()} comparisons after pruning`);
  console.log(`  ${pairs.size} ayahs have a confusable partner`);

  /* Verification, against families every hafiz knows. */
  const partnersOf = (key: string) => pairs.get(key) ?? [];

  const refrain = partnersOf("55:13");
  const formula = partnersOf("26:9");

  console.log(
    `  ${refrain.some((p) => p.score === 1) ? "✓" : "✗"} Ar-Rahman's refrain has an exact twin (55:13 → ${refrain[0]?.k})`,
  );
  console.log(
    `  ${formula.some((p) => p.score === 1 && p.k.startsWith("26:")) ? "✓" : "✗"} Ash-Shu'ara's closing formula repeats within its surah (26:9 → ${formula[0]?.k})`,
  );

  if (!refrain.some((p) => p.score === 1) || !formula.some((p) => p.score === 1)) {
    console.error("\n✗ a known family was not found. Nothing written.");
    process.exit(1);
  }

  const exact = [...pairs.values()].filter((list) => list[0].score === 1).length;
  const near = [...pairs.values()].filter(
    (list) => list[0].score < 1 && list[0].score >= 0.85,
  ).length;
  console.log(`  ${exact} ayahs have an exact twin, ${near} a near-twin above 0.85`);

  /* The near-twins are the interesting ones: alike enough to confuse, different
     enough that getting it wrong is a real mistake. */
  console.log("\n  a few near-twins, for eyeballing:");
  const samples = [...pairs.entries()]
    .filter(([, list]) => list[0].score >= 0.85 && list[0].score < 1)
    .slice(0, 4);
  for (const [key, list] of samples) {
    console.log(`    ${key} ↔ ${list[0].k}  ${list[0].score.toFixed(2)}`);
    console.log(`      ${byKey.get(key)!.t.slice(0, 62)}`);
    console.log(`      ${byKey.get(list[0].k)!.t.slice(0, 62)}`);
  }

  const payload = Object.fromEntries(
    [...pairs.entries()].map(([key, list]) => [
      key,
      list.map((p) => ({
        k: p.k,
        s: byKey.get(p.k)!.s,
        a: byKey.get(p.k)!.a,
        p: byKey.get(p.k)!.p,
        score: Number(p.score.toFixed(3)),
      })),
    ]),
  );

  await writeFile(OUT, JSON.stringify(payload));
  console.log(`\n✓ wrote ${path.relative(process.cwd(), OUT)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
