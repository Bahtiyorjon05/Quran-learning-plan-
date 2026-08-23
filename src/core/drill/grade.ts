/**
 * Marking a drill.
 *
 * Two principles decide everything here.
 *
 * The first: never mark a reciter wrong for something that is not a mistake.
 * Arabic typed on a phone keyboard will not carry the Uthmani marks, alef will
 * arrive in whichever dress the keyboard offers, and none of that is an error
 * in hifz. Comparison is done on the normalised skeleton.
 *
 * The second: a recitation is not multiple choice. Asking someone to type a
 * whole ayah exactly is a test of typing, so recall is judged by how much of
 * the passage is there, not by whether it matches character for character.
 */

import { normalizeArabic, normalizedWords, similarity } from "@/core/quran/arabic";

import type { Question } from "./types";

/**
 * How close a typed ayah has to be to count as recalled.
 *
 * Deliberately not 1: a missing "wa" is not a forgotten ayah, and the mode
 * exists to check that the passage is held, not that it was transcribed.
 */
export const RECALL_THRESHOLD = 0.85;

/** What the reciter submitted for one question. */
export type Answer =
  /* Typed into the blanks of a reveal question, in blank order. */
  | { kind: "reveal"; words: string[]; hints?: number }
  /* The whole passage, typed or dictated. */
  | { kind: "recall"; text: string; hints?: number }
  /* A chosen id. */
  | { kind: "choice"; choiceId: string | null }
  /* Choice ids in the order the reciter placed them. */
  | { kind: "order"; choiceIds: string[] };

export type Mark = {
  /** How many things this question asked for. */
  total: number;
  correct: number;
  hints: number;
  /** Which of the asked-for items were wrong, for showing where. */
  wrongAt: number[];
};

export function markQuestion(question: Question, answer: Answer | null): Mark {
  switch (question.kind) {
    case "reveal": {
      const total = question.blanks.length;
      if (!answer || answer.kind !== "reveal") return blank(total);

      const wrongAt: number[] = [];
      let correct = 0;

      question.blanks.forEach((wordIndex, i) => {
        const expected = normalizeArabic(question.words[wordIndex].text);
        const given = normalizeArabic(answer.words[i] ?? "");
        if (given.length > 0 && given === expected) correct++;
        else wrongAt.push(i);
      });

      return { total, correct, hints: clampHints(answer.hints, total), wrongAt };
    }

    case "recall": {
      if (!answer || answer.kind !== "recall") return blank(1);

      const score = similarity(normalizedWords(question.answer), normalizedWords(answer.text));
      const passed = score >= RECALL_THRESHOLD;

      return {
        total: 1,
        correct: passed ? 1 : 0,
        hints: clampHints(answer.hints, 1),
        wrongAt: passed ? [] : [0],
      };
    }

    case "choice": {
      if (!answer || answer.kind !== "choice") return blank(1);
      const passed = answer.choiceId === question.answerId;
      return { total: 1, correct: passed ? 1 : 0, hints: 0, wrongAt: passed ? [] : [0] };
    }

    case "order": {
      const total = question.answerIds.length;
      if (!answer || answer.kind !== "order") return blank(total);

      const wrongAt: number[] = [];
      let correct = 0;

      question.answerIds.forEach((id, position) => {
        if (answer.choiceIds[position] === id) correct++;
        else wrongAt.push(position);
      });

      return { total, correct, hints: 0, wrongAt };
    }
  }
}

export type DrillResult = {
  total: number;
  correct: number;
  hints: number;
  marks: Mark[];
  /** 0–1, for showing a score. */
  accuracy: number;
};

export function markDrill(questions: readonly Question[], answers: readonly (Answer | null)[]) {
  const marks = questions.map((question, i) => markQuestion(question, answers[i] ?? null));

  const total = marks.reduce((n, m) => n + m.total, 0);
  const correct = marks.reduce((n, m) => n + m.correct, 0);
  const hints = marks.reduce((n, m) => n + m.hints, 0);

  return {
    total,
    correct,
    hints,
    marks,
    accuracy: total === 0 ? 0 : correct / total,
  } satisfies DrillResult;
}

/**
 * Where the reciter went wrong, as ayah references.
 *
 * This is what makes a mistake worth recording: not "68%" but "you lost the
 * fourth word of 2:255 and confused 2:49 with 7:141", which is a thing that can
 * be worked on.
 */
export function missedRefs(questions: readonly Question[], marks: readonly Mark[]) {
  const out: { k: string; s: number; a: number; p: number; wordIndex: number | null }[] = [];

  questions.forEach((question, i) => {
    const mark = marks[i];
    if (!mark || mark.wrongAt.length === 0) return;

    if (question.kind === "reveal") {
      for (const blankIndex of mark.wrongAt) {
        out.push({ ...question.ref, wordIndex: question.blanks[blankIndex] ?? null });
      }
      return;
    }

    if (question.kind === "order") {
      for (const position of mark.wrongAt) {
        const ref = question.refs[position];
        if (ref) out.push({ ...ref, wordIndex: null });
      }
      return;
    }

    out.push({ ...question.ref, wordIndex: null });
  });

  return out;
}

function blank(total: number): Mark {
  return {
    total,
    correct: 0,
    hints: 0,
    wrongAt: Array.from({ length: total }, (_, i) => i),
  };
}

/** A reciter cannot take more hints than there were things to ask for. */
function clampHints(hints: number | undefined, total: number): number {
  if (!hints || hints < 0) return 0;
  return Math.min(Math.floor(hints), total);
}
