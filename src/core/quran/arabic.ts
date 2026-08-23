/**
 * Comparing Arabic the way a reciter's memory does.
 *
 * Two passages that confuse a hafiz are rarely different in their consonants —
 * they differ in a preposition, a plural, a word order. To find those pairs the
 * text has to be compared with the marks that do not change the skeleton
 * stripped away, exactly as the mind holds it.
 *
 * Nothing here ever touches the text that is *displayed*. Normalisation is for
 * comparison only; what a reader sees is always the untouched Uthmani.
 */

/* Harakat, tanwin, sukun, shadda, the superscript alef and the Uthmani
   recitation marks. All are removed for comparison. */
const MARKS =
  /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ]/g;

/** Alef in every dress, plus the wasla the Uthmani script uses. */
const ALEF = /[آأإٱٲٳٵ]/g;

export function normalizeArabic(text: string): string {
  return text
    .replace(MARKS, "")
    .replace(ALEF, "ا")
    .replace(/ى/g, "ي") // alef maqsura → ya
    .replace(/ة/g, "ه") // ta marbuta → ha
    .replace(/[۩۞۝]/g, "") // sajda and end-of-ayah ornaments
    .replace(/\s+/g, " ")
    .trim();
}

/** Words of a normalised ayah, for comparison. */
export function normalizedWords(text: string): string[] {
  const normalized = normalizeArabic(text);
  return normalized ? normalized.split(" ") : [];
}

/**
 * Words of the *displayed* text, kept exactly as written.
 *
 * Drills hide and reveal these, so a single mark lost here would be a mark lost
 * from the Qur'an on someone's screen.
 */
export function displayWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * How alike two passages are, from 0 to 1.
 *
 * Word-multiset overlap rather than character distance: a hafiz confuses
 * passages built from the same words, and character measures reward two long
 * ayahs merely for both being long.
 */
export function similarity(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const word of a) counts.set(word, (counts.get(word) ?? 0) + 1);

  let shared = 0;
  for (const word of b) {
    const left = counts.get(word);
    if (left) {
      shared++;
      counts.set(word, left - 1);
    }
  }

  // Dice coefficient: forgiving of one passage being a little longer.
  return (2 * shared) / (a.length + b.length);
}
