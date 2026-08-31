/**
 * Who recites, and where the audio comes from.
 *
 * Only reciters whose audio actually plays are listed. Offering a name that
 * produces silence is worse than not offering it at all.
 *
 * Two kinds of source, because the world only offers two:
 *
 *   "ayah"   one file per verse (islamic.network). The player can mark the
 *            verse being recited, scroll to it, and loop a single one — which
 *            is what makes the reader useful for memorising rather than just
 *            for listening.
 *
 *   "surah"  one file for the whole chapter (mp3quran.net). It plays, and
 *            nothing else: there is no timing data, so nothing can know which
 *            verse is sounding at a given second. Marked in the interface as
 *            such rather than quietly behaving differently.
 *
 * Badr al-Turki is here as "surah" for exactly that reason. He is on no
 * per-verse CDN — not islamic.network's twenty editions, not everyayah's
 * seventy-four; both were searched in full. Alijon Qori is on neither in any
 * form, so he is not listed: an Uzbek reciter would be the most valuable
 * addition here, and the moment a hosted source exists he is one entry.
 *
 * The bitrate belongs to the reciter, not to the CDN. Every edition publishes
 * a different set, and assuming a single global one is what made Minshawi
 * return 403 on every verse while the others played.
 */

export type ReciterKind = "ayah" | "surah";

export type Reciter = {
  id: string;
  kind: ReciterKind;
  /** Edition slug (per-ayah) or base URL (per-surah). */
  source: string;
  /** Only for per-ayah sources, and only a bitrate that edition publishes. */
  bitrate?: 64 | 128;
  name: { uz: string; en: string; ru: string };
  arabic: string;
  note: { uz: string; en: string; ru: string };
};

export const RECITERS: readonly Reciter[] = [
  {
    id: "alafasy",
    kind: "ayah",
    source: "ar.alafasy",
    bitrate: 64,
    name: { uz: "Mishari Alafasiy", en: "Mishary Alafasy", ru: "Мишари Аль-Афаси" },
    arabic: "مشاري العفاسي",
    note: {
      uz: "Ravon va aniq — yod olish uchun eng koʻp tanlanadigan qiroat.",
      en: "Clear and measured — the recitation most people learn from.",
      ru: "Ясное, размеренное чтение — то, по которому чаще всего учат.",
    },
  },
  {
    id: "husary",
    kind: "ayah",
    source: "ar.husary",
    bitrate: 64,
    name: { uz: "Mahmud Xusariy", en: "Mahmoud al-Husary", ru: "Махмуд Аль-Хусари" },
    arabic: "محمود الحصري",
    note: {
      uz: "Sekin va tartibli — tajvidni oʻrganish uchun klassik tanlov.",
      en: "Slow and exact — the classical choice for learning tajweed.",
      ru: "Медленное и точное — классический выбор для изучения таджвида.",
    },
  },
  {
    id: "minshawi",
    kind: "ayah",
    /* 128 only. This edition publishes no 64k, and asking for one returned 403
       on every single verse. */
    source: "ar.minshawi",
    bitrate: 128,
    name: { uz: "Muhammad Minshoviy", en: "Mohamed al-Minshawi", ru: "Мухаммад Аль-Миншави" },
    arabic: "محمد المنشاوي",
    note: {
      uz: "Yumshoq va vazmin, uzoq mashgʻulotlar uchun qulay.",
      en: "Gentle and unhurried, easy to sit with for a long session.",
      ru: "Мягкое и неспешное, удобно для долгих занятий.",
    },
  },
  {
    id: "badr",
    kind: "surah",
    source: "https://server10.mp3quran.net/bader/Rewayat-Hafs-A-n-Assem",
    name: { uz: "Badr at-Turkiy", en: "Badr al-Turki", ru: "Бадр Ат-Турки" },
    arabic: "بدر التركي",
    note: {
      uz: "Butun sura bir faylda — oyatma-oyat kuzatib boʻlmaydi.",
      en: "The whole surah in one file — it cannot follow along verse by verse.",
      ru: "Вся сура одним файлом — следить по аятам не получится.",
    },
  },
];

export type ReciterId = (typeof RECITERS)[number]["id"];

export const DEFAULT_RECITER: ReciterId = "alafasy";

export function isReciterId(value: string): boolean {
  return RECITERS.some((r) => r.id === value);
}

export function reciter(id: string): Reciter {
  return RECITERS.find((r) => r.id === id) ?? RECITERS[0];
}

/** Whether this reciter can drive the highlight, the scroll and ayah repeat. */
export function followsAlong(id: string): boolean {
  return reciter(id).kind === "ayah";
}

/** How many ayahs each surah has, in order — the only thing needed to number them. */
const AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89,
  59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30,
  52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15,
  21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

/**
 * Where an ayah sits in the whole Qur'an, from 1 to 6236.
 *
 * The per-ayah CDN addresses audio by this number, and the shipped index stores
 * surah and ayah. Computed rather than stored: it is a sum of a fixed table,
 * and a second copy of it in the data would be a second thing to keep right.
 */
export function globalAyahNumber(surah: number, ayah: number): number {
  let total = 0;
  for (let s = 1; s < surah; s++) total += AYAH_COUNTS[s - 1];
  return total + ayah;
}

/** The mp3 for one ayah. Only meaningful for a per-ayah reciter. */
export function ayahAudioUrl(reciterId: string, surah: number, ayah: number): string {
  const r = reciter(reciterId);
  const number = globalAyahNumber(surah, ayah);
  return `https://cdn.islamic.network/quran/audio/${r.bitrate ?? 128}/${r.source}/${number}.mp3`;
}

/** The mp3 for a whole surah. Only meaningful for a per-surah reciter. */
export function surahAudioUrl(reciterId: string, surah: number): string {
  const padded = String(surah).padStart(3, "0");
  return `${reciter(reciterId).source}/${padded}.mp3`;
}
