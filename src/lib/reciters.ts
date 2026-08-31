/**
 * Who recites, and where the audio comes from.
 *
 * Only reciters whose audio actually plays are listed. Offering a name that
 * produces silence is worse than not offering it, and the two that are missing
 * are missing for a real reason: Badr al-Turki and Alijon Qori are not on the
 * open CDN this uses, nor on everyayah, so there is nothing to fetch. Adding
 * either later is one entry in this array plus a `url` that resolves — the rest
 * of the product reads from here.
 *
 * The audio is served per ayah by islamic.network, addressed by the ayah's
 * position in the whole Qur'an rather than by surah and ayah. That number is
 * not in the shipped index, so it is derived — see `globalAyahNumber`.
 */

export type Reciter = {
  id: string;
  /** The edition slug on the CDN. */
  edition: string;
  /** Their name, in each language the product speaks. */
  name: { uz: string; en: string; ru: string };
  arabic: string;
  /** A word on the style, so the choice means something to a beginner. */
  note: { uz: string; en: string; ru: string };
};

export const RECITERS: readonly Reciter[] = [
  {
    id: "alafasy",
    edition: "ar.alafasy",
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
    edition: "ar.husary",
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
    edition: "ar.minshawi",
    name: { uz: "Muhammad Minshoviy", en: "Mohamed al-Minshawi", ru: "Мухаммад Аль-Миншави" },
    arabic: "محمد المنشاوي",
    note: {
      uz: "Yumshoq va vazmin, uzoq mashgʻulotlar uchun qulay.",
      en: "Gentle and unhurried, easy to sit with for a long session.",
      ru: "Мягкое и неспешное, удобно для долгих занятий.",
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
 * The CDN addresses audio by this number, and the shipped index stores surah
 * and ayah instead. Computed rather than stored: it is a sum of a fixed table,
 * and a second copy of it in the data would be a second thing to keep right.
 */
export function globalAyahNumber(surah: number, ayah: number): number {
  let total = 0;
  for (let s = 1; s < surah; s++) total += AYAH_COUNTS[s - 1];
  return total + ayah;
}

/** The mp3 for one ayah, at a bitrate that is small enough for a phone. */
export function ayahAudioUrl(reciterId: string, surah: number, ayah: number): string {
  const edition = reciter(reciterId).edition;
  return `https://cdn.islamic.network/quran/audio/64/${edition}/${globalAyahNumber(surah, ayah)}.mp3`;
}
