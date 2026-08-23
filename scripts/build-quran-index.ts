/**
 * Builds the Qur'an data the app ships with.
 *
 * Fetches the Uthmani text and three translations, checks the result against
 * facts about the mushaf that are not negotiable, splits it by juz so a reader
 * loads a fraction rather than the whole book, and records a checksum so any
 * later corruption is loud instead of silent.
 *
 *   npm run quran:build
 *
 * Getting this right is a religious responsibility, not a data-loading chore.
 * The script refuses to write anything if a single structural check fails.
 */
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "src/data/quran");
const API = "https://api.alquran.cloud/v1/quran";

/** Openly licensed, and each the standard choice for its language. */
const EDITIONS = {
  uthmani: { id: "quran-uthmani", label: "Uthmani script", licence: "alquran.cloud" },
  uz: { id: "uz.sodik", label: "Muhammad Sodik Muhammad Yusuf", licence: "alquran.cloud" },
  ru: { id: "ru.kuliev", label: "Elmir Kuliev", licence: "alquran.cloud" },
  en: { id: "en.sahih", label: "Saheeh International", licence: "alquran.cloud" },
} as const;

/* ── Facts the data must satisfy ────────────────────────────────────────── */
const TOTAL_SURAHS = 114;
const TOTAL_AYAHS = 6236;
const TOTAL_PAGES = 604;
const TOTAL_JUZ = 30;

/** Spot checks anyone can verify against a physical mushaf. */
const LANDMARKS = [
  { key: "1:1", page: 1, juz: 1 }, // the opening
  { key: "2:255", page: 42, juz: 3 }, // Ayat al-Kursi
  { key: "18:1", page: 293, juz: 15 }, // Al-Kahf
  { key: "36:1", page: 440, juz: 22 }, // Ya-Sin
  { key: "78:1", page: 582, juz: 30 }, // An-Naba, where juz 30 begins
  { key: "114:6", page: 604, juz: 30 }, // the last ayah
];

const AYAH_COUNTS: Record<number, number> = { 1: 7, 2: 286, 18: 110, 36: 83, 114: 6 };

/**
 * The basmala, exactly as this edition spells it.
 *
 * The source glues it onto the first ayah of every surah except Al-Fatiha —
 * where it *is* ayah 1 — and At-Tawbah, which has none. Left alone, 2:1 would
 * read "In the name of Allah… Alif Lam Mim" as a single ayah, which is simply
 * not what the ayah is. It is split off and carried separately so the reader
 * can render it as the heading it is.
 */
const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

/** Strips the byte-order mark the source leaves on the very first ayah. */
function clean(text: string): string {
  return text.replace(/^﻿/, "").trim();
}

/**
 * Repairs a typo in the source edition.
 *
 * At-Tin and Al-Qadr open with a stray shadda on the bā' of the basmala —
 * U+0628 U+0651 U+0650 where every other surah has U+0628 U+0650. The spelling
 * of the basmala is not a matter of opinion, so this is a defect in the data
 * rather than a variant, and leaving it would put a misspelt basmala on two
 * pages of the mushaf.
 *
 * Repaired only when the rest of the phrase matches exactly, and the count is
 * asserted afterwards, so this can never quietly start rewriting more than the
 * two ayahs it was written for.
 */
function repairBasmalaTypo(text: string): { text: string; repaired: boolean } {
  const STRAY = "بِّ"; // bā' + shadda + kasra
  const tail = BASMALA.slice(2); // everything from the sīn onwards

  if (text.startsWith(STRAY) && text.slice(STRAY.length).startsWith(tail)) {
    return { text: BASMALA.slice(0, 2) + text.slice(STRAY.length), repaired: true };
  }
  return { text, repaired: false };
}

type ApiAyah = {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  page: number;
  hizbQuarter: number;
  sajda: boolean | { recommended: boolean; obligatory: boolean };
  surah: {
    number: number;
    name: string;
    englishName: string;
    englishNameTranslation: string;
    revelationType: string;
    numberOfAyahs: number;
  };
};

async function fetchEdition(id: string): Promise<ApiAyah[]> {
  process.stdout.write(`  fetching ${id} … `);
  const response = await fetch(`${API}/${id}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);

  /* The whole-Qur'an endpoint nests ayahs inside their surah and does not
     repeat the surah on each one — unlike the single-ayah endpoint. Attach it
     while flattening so everything downstream sees a uniform shape. */
  type ApiSurah = ApiAyah["surah"] & { ayahs: Omit<ApiAyah, "surah">[] };
  const body = (await response.json()) as { data: { surahs: ApiSurah[] } };

  const ayahs: ApiAyah[] = body.data.surahs.flatMap(({ ayahs: inSurah, ...surah }) =>
    inSurah.map((ayah) => ({ ...ayah, text: clean(ayah.text), surah })),
  );
  console.log(`${ayahs.length} ayahs`);
  return ayahs;
}

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  console.error("  Nothing was written.");
  process.exit(1);
}

async function main() {
  console.log("Fetching editions:");
  const [uthmani, uz, ru, en] = await Promise.all([
    fetchEdition(EDITIONS.uthmani.id),
    fetchEdition(EDITIONS.uz.id),
    fetchEdition(EDITIONS.ru.id),
    fetchEdition(EDITIONS.en.id),
  ]);

  /* ── Verify before writing ─────────────────────────────────────────────── */
  console.log("\nVerifying:");

  for (const [name, list] of [
    ["uthmani", uthmani],
    ["uz", uz],
    ["ru", ru],
    ["en", en],
  ] as const) {
    if (list.length !== TOTAL_AYAHS) fail(`${name} has ${list.length} ayahs, expected ${TOTAL_AYAHS}`);
  }
  console.log(`  ✓ every edition has ${TOTAL_AYAHS} ayahs`);

  const byKey = new Map<string, ApiAyah>();
  for (const ayah of uthmani) byKey.set(`${ayah.surah.number}:${ayah.numberInSurah}`, ayah);
  if (byKey.size !== TOTAL_AYAHS) fail("ayah keys are not unique");

  const surahNumbers = new Set(uthmani.map((a) => a.surah.number));
  if (surahNumbers.size !== TOTAL_SURAHS) fail(`found ${surahNumbers.size} surahs`);
  console.log(`  ✓ ${TOTAL_SURAHS} surahs, ${byKey.size} unique ayah keys`);

  for (const [surah, count] of Object.entries(AYAH_COUNTS)) {
    const actual = uthmani.filter((a) => a.surah.number === Number(surah)).length;
    if (actual !== count) fail(`surah ${surah} has ${actual} ayahs, expected ${count}`);
  }
  console.log("  ✓ known ayah counts match");

  for (const landmark of LANDMARKS) {
    const ayah = byKey.get(landmark.key);
    if (!ayah) fail(`${landmark.key} is missing`);
    if (ayah.page !== landmark.page) {
      fail(`${landmark.key} is on page ${ayah.page}, expected ${landmark.page}`);
    }
    if (ayah.juz !== landmark.juz) {
      fail(`${landmark.key} is in juz ${ayah.juz}, expected ${landmark.juz}`);
    }
  }
  console.log(`  ✓ ${LANDMARKS.length} landmarks sit on the right page and juz`);

  const pages = new Set(uthmani.map((a) => a.page));
  if (pages.size !== TOTAL_PAGES) fail(`found ${pages.size} pages, expected ${TOTAL_PAGES}`);
  for (let page = 1; page <= TOTAL_PAGES; page++) {
    if (!pages.has(page)) fail(`page ${page} has no ayahs`);
  }
  console.log(`  ✓ all ${TOTAL_PAGES} pages are populated`);

  const juzNumbers = new Set(uthmani.map((a) => a.juz));
  if (juzNumbers.size !== TOTAL_JUZ) fail(`found ${juzNumbers.size} juz`);
  console.log(`  ✓ ${TOTAL_JUZ} juz`);

  const empty = uthmani.filter((a) => !a.text?.trim());
  if (empty.length) fail(`${empty.length} ayahs have no text`);
  console.log("  ✓ no empty ayah text");

  /* Repair the two misspelt openings before anything else looks at them. */
  const repaired: number[] = [];
  for (const ayah of uthmani) {
    if (ayah.numberInSurah !== 1) continue;
    const fix = repairBasmalaTypo(ayah.text);
    if (fix.repaired) {
      ayah.text = fix.text;
      repaired.push(ayah.surah.number);
    }
  }
  if (repaired.length !== 2 || repaired[0] !== 95 || repaired[1] !== 97) {
    fail(`expected to repair the basmala in surahs 95 and 97, repaired [${repaired}]`);
  }
  console.log(`  ✓ repaired the stray shadda in surahs ${repaired.join(" and ")}`);

  /* Detach the basmala from every opening ayah that carries it. */
  let detached = 0;
  for (const ayah of uthmani) {
    if (ayah.numberInSurah !== 1) continue;
    if (ayah.surah.number === 1) continue; // there, the basmala is the ayah
    if (!ayah.text.startsWith(BASMALA)) continue;
    ayah.text = ayah.text.slice(BASMALA.length).trim();
    detached++;
  }

  /* 114 surahs, minus Al-Fatiha where it is ayah 1, minus At-Tawbah which has
     none, leaves 112 openings that should have carried a prefix. */
  if (detached !== 112) fail(`detached the basmala from ${detached} ayahs, expected 112`);

  const stillPrefixed = uthmani.filter(
    (a) => a.text.startsWith(BASMALA) && !(a.surah.number === 1 && a.numberInSurah === 1),
  );
  if (stillPrefixed.length) {
    fail(`${stillPrefixed.length} ayahs still begin with the basmala, e.g. ${stillPrefixed[0].surah.number}:${stillPrefixed[0].numberInSurah}`);
  }

  const fatiha = byKey.get("1:1")!;
  if (fatiha.text !== BASMALA) fail("1:1 is not the basmala exactly");

  const tawbah = byKey.get("9:1")!;
  if (tawbah.text.startsWith(BASMALA)) fail("At-Tawbah must not carry a basmala");

  const baqara = byKey.get("2:1")!;
  if (baqara.text.includes(BASMALA)) fail("2:1 still contains the basmala");
  console.log(`  ✓ basmala detached from ${detached} opening ayahs; 1:1 and 9:1 correct`);

  /* ── Shape it ──────────────────────────────────────────────────────────── */
  const translations = {
    uz: new Map(uz.map((a) => [`${a.surah.number}:${a.numberInSurah}`, a.text])),
    ru: new Map(ru.map((a) => [`${a.surah.number}:${a.numberInSurah}`, a.text])),
    en: new Map(en.map((a) => [`${a.surah.number}:${a.numberInSurah}`, a.text])),
  };

  const surahs = [...surahNumbers]
    .sort((a, b) => a - b)
    .map((number) => {
      const first = uthmani.find((a) => a.surah.number === number)!;
      const ayahs = uthmani.filter((a) => a.surah.number === number);
      return {
        number,
        name: first.surah.name,
        latin: first.surah.englishName,
        meaning: first.surah.englishNameTranslation,
        revelation: first.surah.revelationType === "Meccan" ? "makkah" : "madinah",
        ayahs: ayahs.length,
        startPage: first.page,
        endPage: ayahs[ayahs.length - 1].page,
        /* Whether the reader should render the basmala as a *heading* above
           ayah 1. False for two surahs, for opposite reasons: At-Tawbah has no
           basmala at all, and in Al-Fatiha the basmala IS ayah 1 — printing a
           heading there would show it twice on the same page. */
        basmala: number !== 9 && number !== 1,
      };
    });

  /* Page index: which ayahs a page holds, and which surahs it spans. Small
     enough to keep loaded at all times, which is what the reader navigates by. */
  const pageIndex = Array.from({ length: TOTAL_PAGES }, (_, i) => {
    const page = i + 1;
    const onPage = uthmani.filter((a) => a.page === page);
    return {
      page,
      juz: onPage[0].juz,
      hizbQuarter: onPage[0].hizbQuarter,
      surahs: [...new Set(onPage.map((a) => a.surah.number))],
      first: `${onPage[0].surah.number}:${onPage[0].numberInSurah}`,
      last: `${onPage[onPage.length - 1].surah.number}:${onPage[onPage.length - 1].numberInSurah}`,
      ayahs: onPage.length,
    };
  });

  /* Remove only what this script generates. An earlier version wiped the whole
     directory and took loader.ts and its tests with it — a build step must
     never delete files it did not write. */
  await rm(path.join(OUT, "juz"), { recursive: true, force: true });
  await rm(path.join(OUT, "meta.json"), { force: true });
  await mkdir(path.join(OUT, "juz"), { recursive: true });

  /* Split by juz so the reader downloads a thirtieth of the book, not all of
     it, and so no single chunk dominates the server bundle. */
  let bytes = 0;
  for (let juz = 1; juz <= TOTAL_JUZ; juz++) {
    const inJuz = uthmani.filter((a) => a.juz === juz);
    const payload = {
      juz,
      ayahs: inJuz.map((a) => {
        const key = `${a.surah.number}:${a.numberInSurah}`;
        return {
          k: key,
          s: a.surah.number,
          a: a.numberInSurah,
          p: a.page,
          t: a.text,
          sajda: a.sajda === true || (typeof a.sajda === "object" && a.sajda !== null),
          uz: translations.uz.get(key) ?? "",
          ru: translations.ru.get(key) ?? "",
          en: translations.en.get(key) ?? "",
        };
      }),
    };
    const json = JSON.stringify(payload);
    bytes += json.length;
    await writeFile(path.join(OUT, "juz", `${juz}.json`), json);
  }

  const checksum = createHash("sha256")
    .update(uthmani.map((a) => a.text).join("\n"))
    .digest("hex");

  await writeFile(
    path.join(OUT, "meta.json"),
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        source: "api.alquran.cloud",
        editions: EDITIONS,
        totals: { surahs: TOTAL_SURAHS, ayahs: TOTAL_AYAHS, pages: TOTAL_PAGES, juz: TOTAL_JUZ },
        basmala: BASMALA,
        /* Recorded rather than hidden: the source misspelt the basmala in these
           two surahs and the pipeline corrected it. */
        repairedBasmalaIn: [95, 97],
        /* SHA-256 over the Arabic text alone. A test asserts the shipped data
           still hashes to this, so corruption is loud rather than silent. */
        uthmaniChecksum: checksum,
        surahs,
        pages: pageIndex,
      },
      null,
      0,
    ),
  );

  console.log(`\n✓ wrote ${OUT}`);
  console.log(`  meta.json + 30 juz files, ${(bytes / 1024 / 1024).toFixed(2)} MB of text`);
  console.log(`  uthmani sha256: ${checksum}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
