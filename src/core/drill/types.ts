/**
 * What a drill is made of.
 *
 * Kept separate from the generators so the UI can import these types without
 * pulling in the generation logic, and so a question can travel from server to
 * client as plain data.
 *
 * Nothing here asks anyone to type Arabic. An Arabic keyboard is not something
 * most people have, and on a phone it turns a thirty-second drill into a
 * five-minute fight with an input method — so every question is answered by
 * tapping: choosing a word, choosing a passage, or putting things in order.
 */

export const DRILL_MODES = [
  "hide",
  "firstWord",
  "next",
  "shuffle",
  "gap",
  "mutashabihat",
] as const;

export type DrillMode = (typeof DRILL_MODES)[number];

export type AyahRef = {
  /** "2:255" */
  k: string;
  s: number;
  a: number;
  p: number;
};

/** An ayah with its text, as the generators receive it. */
export type SourceAyah = AyahRef & { t: string };

/** One word of a displayed ayah, and whether the drill has taken it away. */
export type DrillWord = {
  text: string;
  hidden: boolean;
};

/** A tappable word. The id is positional so identical words stay distinct. */
export type BankWord = {
  id: string;
  text: string;
};

export type Choice = {
  id: string;
  /** Arabic for a passage, or empty when the choice is a bare reference. */
  text: string;
  /** Present when the choice is an ayah, so a wrong answer can be explained. */
  ref?: AyahRef;
};

/**
 * A single thing to answer.
 *
 * Three shapes cover all six modes: putting words back into an ayah, choosing
 * between passages, and putting ayahs back in order.
 */
export type Question =
  /* Progressive hide, fill-the-gap and the first-word prompt. Words have been
     lifted out of the ayah and must be tapped back into place. */
  | {
      kind: "assemble";
      mode: Extract<DrillMode, "hide" | "gap" | "firstWord">;
      ref: AyahRef;
      /** The ayah as displayed; hidden words render as empty slots. */
      words: DrillWord[];
      /** Indices into `words` that must be supplied, in reading order. */
      blanks: number[];
      /** The missing words plus plausible decoys, shuffled. */
      bank: BankWord[];
      /** Whether the ayah continues past what this question asks for. */
      truncated: boolean;
    }
  /* What-comes-next and the mutashabihat duel. */
  | {
      kind: "choice";
      mode: Extract<DrillMode, "next" | "mutashabihat">;
      ref: AyahRef;
      prompt: string;
      choices: Choice[];
      answerId: string;
    }
  /* Ayah shuffle: put a run of ayahs back into order. */
  | {
      kind: "order";
      mode: Extract<DrillMode, "shuffle">;
      refs: AyahRef[];
      /** The ayahs as presented, out of order. */
      shuffled: Choice[];
      /** Choice ids in the order they belong. */
      answerIds: string[];
    };

export type Drill = {
  mode: DrillMode;
  /** The page this drill was built from, for logging the review against it. */
  page: number;
  questions: Question[];
};

/** How many things the reciter has to get right for a full drill. */
export function questionCount(drill: Drill): number {
  return drill.questions.reduce((total, question) => {
    switch (question.kind) {
      case "assemble":
        return total + question.blanks.length;
      case "order":
        return total + question.answerIds.length;
      default:
        return total + 1;
    }
  }, 0);
}
