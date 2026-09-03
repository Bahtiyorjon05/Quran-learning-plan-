import { describe, expect, it } from "vitest";

import { confusableOnPage, loadJuz, loadPage, PAGES, SURAHS } from "@/data/quran/loader";
import { displayWords, normalizeArabic } from "./quran/arabic";
import { availableModes, generateDrill } from "./drill/generate";
import type { Question } from "./drill/types";

/**
 * The text, over the whole Qur'an, through every drill.
 *
 * Everything else in this suite tests behaviour on a five-ayah fixture. This
 * one is different in kind: it walks all 604 pages and asserts that no drill
 * ever puts a character on screen that is not exactly what the source says.
 *
 * The reason it is worth the seconds it costs is that the failure it guards
 * against is silent. A normalisation that eats a mark, an off-by-one that
 * shows the wrong ayah under the right reference, a word split that loses a
 * waqf sign — none of these throw, none of these look wrong to somebody who is
 * not a hafiz, and all of them would be putting words in front of a reader as
 * though they were the Qur'an. The five-ayah fixture has already missed one of
 * these once: the standalone ۛ in 2:2 was blanked into an unanswerable gap and
 * only a walk of every page found it.
 *
 * So the rule enforced here is absolute and deliberately unsubtle: whatever a
 * question displays must be reconstructible, character for character, from the
 * ayah it names.
 */

/** The canonical form: the source text with runs of whitespace collapsed. */
function canonical(text: string): string {
  return text.split(/\s+/).filter(Boolean).join(" ");
}

type Source = { k: string; s: number; a: number; t: string; p: number };

/** Every ayah in the Qur'an, once, keyed by "surah:ayah". */
async function wholeQuran(): Promise<Map<string, Source>> {
  const all = new Map<string, Source>();
  for (let juz = 1; juz <= 30; juz++) {
    const file = await loadJuz(juz);
    for (const ayah of file.ayahs) {
      all.set(ayah.k, ayah as Source);
    }
  }
  return all;
}

describe("the text itself", () => {
  it("has every ayah of every surah, and nothing else", async () => {
    const all = await wholeQuran();

    /* 6,236 is the count of the Uthmani mushaf this app ships. A number that
       drifts means the data has been rebuilt wrongly. */
    expect(all.size).toBe(6236);

    for (const surah of SURAHS) {
      for (let ayah = 1; ayah <= surah.ayahs; ayah++) {
        const found = all.get(`${surah.number}:${ayah}`);
        expect(found, `${surah.number}:${ayah} is missing`).toBeDefined();
        expect(found!.s).toBe(surah.number);
        expect(found!.a).toBe(ayah);
        expect(found!.t.trim().length, `${surah.number}:${ayah} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it("survives being split into words", async () => {
    /* Drills hide and reveal words. If splitting and rejoining is not lossless
       then every drill that does so is altering the Qur'an. */
    for (const ayah of (await wholeQuran()).values()) {
      expect(displayWords(ayah.t).join(" "), ayah.k).toBe(canonical(ayah.t));
    }
  });

  it("never normalises a whole ayah away", async () => {
    /* Comparison is done on the normalised form. An ayah that normalises to
       nothing cannot be graded at all, and a word that does is a blank nobody
       can fill — which is the bug 2:2 hid for a while. */
    for (const ayah of (await wholeQuran()).values()) {
      expect(normalizeArabic(ayah.t).length, ayah.k).toBeGreaterThan(0);
    }
  });

  it("puts every page in exactly one place", async () => {
    const all = await wholeQuran();
    expect(PAGES.length).toBe(604);

    const seen = new Set<string>();
    for (const ayah of all.values()) {
      expect(ayah.p, `${ayah.k} sits on page ${ayah.p}`).toBeGreaterThanOrEqual(1);
      expect(ayah.p).toBeLessThanOrEqual(604);
      seen.add(ayah.k);
    }
    expect(seen.size).toBe(all.size);
  });
});

/**
 * What a drill is allowed to show of an ayah.
 *
 * Not always the whole thing, and that is correct: "continue from here" shows
 * an opening and asks for the rest, and a multiple-choice preview ends in an
 * ellipsis so the answer is not sitting in the question. Neither alters a
 * word.
 *
 * So the rule is not "shows everything" but the one that actually matters:
 * every word displayed is the source's own word, in the source's own order,
 * counting from the beginning of the ayah. Nothing added, nothing changed,
 * nothing rearranged.
 */
function isFaithful(shown: string, source: string): boolean {
  const elided = shown.trimEnd().endsWith("…");
  const body = elided ? shown.trimEnd().slice(0, -1) : shown;

  const shownWords = canonical(body).split(" ").filter(Boolean);
  const sourceWords = canonical(source).split(" ");

  if (shownWords.length === 0) return false;
  if (shownWords.length > sourceWords.length) return false;
  return shownWords.every((word, i) => word === sourceWords[i]);
}

describe("every drill, over the whole mushaf", () => {
  /**
   * Whatever a question shows must come back to the source exactly.
   *
   * Collected rather than thrown one at a time, so a run reports every page
   * that is wrong instead of stopping at the first.
   */
  function checkQuestion(question: Question, all: Map<string, Source>, wrong: string[]) {
    if (question.kind === "assemble") {
      const source = all.get(question.ref.k);
      if (!source) {
        wrong.push(`${question.ref.k}: the drill named an ayah that does not exist`);
        return;
      }

      const shown = question.words.map((word) => word.text).join(" ");

      /* Hiding and filling a gap both lay the whole ayah out and take pieces
         out of it, so anything short of the whole ayah is a lost word. Asking
         someone to continue deliberately shows only an opening. */
      const whole = question.mode === "hide" || question.mode === "gap";
      const ok = whole ? shown === canonical(source.t) : isFaithful(shown, source.t);

      if (!ok) {
        wrong.push(
          `${question.ref.k} (${question.mode}): the words shown are not the words of this ayah`,
        );
      }

      for (const blank of question.blanks) {
        const word = question.words[blank];
        if (!word) {
          wrong.push(`${question.ref.k}: a blank points past the end of the ayah`);
        } else if (normalizeArabic(word.text).length === 0) {
          wrong.push(`${question.ref.k}: a bare mark was blanked, and cannot be answered`);
        }
      }
      return;
    }

    /* choice and order both carry candidate ayahs, each claiming a reference —
       under different names, because one is a question and the other a list. */
    const candidates = question.kind === "choice" ? question.choices : question.shuffled;

    for (const choice of candidates) {
      if (!choice.ref) continue;
      const key = `${choice.ref.s}:${choice.ref.a}`;
      const source = all.get(key);
      if (!source) {
        wrong.push(`${key}: a choice named an ayah that does not exist`);
        continue;
      }
      if (!isFaithful(choice.text, source.t)) {
        wrong.push(`${key} (${question.mode}): a choice showed words that are not that ayah`);
      }
    }
  }

  it("asks the duel inside the surah, and offers a real choice", async () => {
    /* Two failures this guards against, both of which make the hardest drill in
       the product trivial:

         · two choices is a coin, not a question;
         · and a passage from Al-Baqara offered against Ya-Sin is answered by
           recognising the surah, which is not the skill. What makes
           mutashabihat hard is knowing *which verse of the same surah* it was.

       The second can only be promised where the page actually holds another
       verse of that surah — the generator sees one page, not the whole book —
       so that is exactly what is asserted. */
    const wrong: string[] = [];

    for (let page = 1; page <= 604; page++) {
      const { ayahs } = await loadPage(page);
      if (ayahs.length === 0) continue;

      const base = {
        ayahs,
        page,
        seed: page,
        level: 0.5,
        confusable: await confusableOnPage(ayahs),
      };
      if (!availableModes(base).includes("mutashabihat")) continue;

      for (const question of generateDrill("mutashabihat", base).questions) {
        if (question.kind !== "choice") continue;

        const answer = question.choices.find((c) => c.id === question.answerId);
        if (!answer?.ref) {
          wrong.push(`page ${page}: the duel has no answer among its choices`);
          continue;
        }

        const candidates = new Set(ayahs.map((a) => a.k));
        const possible = Math.min(4, candidates.size);
        if (question.choices.length < possible) {
          wrong.push(
            `page ${page}: the duel offered ${question.choices.length} places where ${possible} were available`,
          );
        }

        const surah = answer.ref.s;
        const alsoHere = ayahs.some((a) => a.s === surah && a.k !== answer.id);
        if (alsoHere) {
          const sharing = question.choices.filter((c) => c.ref?.s === surah).length;
          if (sharing < 2) {
            wrong.push(
              `page ${page}: only the answer came from surah ${surah}, so the surah gives it away`,
            );
          }
        }
      }
    }

    expect([...new Set(wrong)].slice(0, 15)).toEqual([]);
  }, 300_000);

  it("never shows a word the Qur'an does not say", async () => {
    const all = await wholeQuran();
    const wrong: string[] = [];

    for (let page = 1; page <= 604; page++) {
      const { ayahs } = await loadPage(page);
      if (ayahs.length === 0) {
        wrong.push(`page ${page} has no ayahs at all`);
        continue;
      }

      const base = { ayahs, page, seed: page, level: 0.5 };

      for (const mode of availableModes(base)) {
        const drill = generateDrill(mode, base);
        for (const question of drill.questions) {
          checkQuestion(question, all, wrong);
        }
      }
    }

    /* Sliced so a systemic break reports a readable sample rather than
       thousands of lines, and de-duplicated because one wrong ayah appears in
       every drill that offers it. */
    expect([...new Set(wrong)].slice(0, 20)).toEqual([]);
  }, 300_000);
});
