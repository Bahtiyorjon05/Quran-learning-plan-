/**
 * What a drill is made of.
 *
 * Kept separate from the generators so the UI can import these types without
 * pulling in the generation logic, and so a question can travel from server to
 * client as plain data.
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

/** One word of a displayed ayah, and whether the drill has covered it. */
export type DrillWord = {
  text: string;
  hidden: boolean;
};

export type Choice = {
  id: string;
  /** Arabic for a passage, or a reference like "Al-Baqara 2:255". */
  text: string;
  /** Present when the choice is an ayah, so a wrong answer can be explained. */
  ref?: AyahRef;
};

/**
 * A single thing to answer.
 *
 * Four shapes cover all six modes: two are about recalling text with parts of
 * it removed, one is multiple choice, one is putting ayahs back in order.
 */
export type Question =
  /* Progressive hide and fill-the-gap: the ayah is shown with words removed. */
  | {
      kind: "reveal";
      mode: Extract<DrillMode, "hide" | "gap">;
      ref: AyahRef;
      words: DrillWord[];
      /** Indices the reciter has to supply. Never empty. */
      blanks: number[];
    }
  /* First-word prompt: an opening is given, the rest is recited from memory. */
  | {
      kind: "recall";
      mode: Extract<DrillMode, "firstWord">;
      ref: AyahRef;
      prompt: string;
      answer: string;
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

/** How many questions the reciter has to get right for a full drill. */
export function questionCount(drill: Drill): number {
  return drill.questions.reduce((total, question) => {
    switch (question.kind) {
      case "reveal":
        return total + question.blanks.length;
      case "order":
        return total + question.answerIds.length;
      default:
        return total + 1;
    }
  }, 0);
}
