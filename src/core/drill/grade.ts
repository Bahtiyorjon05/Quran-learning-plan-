/**
 * Marking a drill.
 *
 * Two principles decide everything here.
 *
 * The first: never mark a reciter wrong for something that is not a mistake.
 * The same word can appear twice in one ayah, and a bank of tapped words has no
 * way of knowing which copy was meant — so a placement is judged by the word it
 * carries, not by which token was tapped.
 *
 * The second: an answer that is missing, or of the wrong shape entirely, is
 * marked wrong rather than allowed to throw. A drill that crashes on submission
 * loses the whole session's work.
 */

import { normalizeArabic } from "@/core/quran/arabic";

import type { Question } from "./types";

/** What the reciter submitted for one question. */
export type Answer =
  /* Bank word ids placed into each blank, in reading order. */
  | { kind: "assemble"; placed: (string | null)[]; hints?: number }
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
    case "assemble": {
      const total = question.blanks.length;
      if (!answer || answer.kind !== "assemble") return blank(total);

      const bank = new Map(question.bank.map((word) => [word.id, word.text]));
      const wrongAt: number[] = [];
      let correct = 0;

      question.blanks.forEach((wordIndex, i) => {
        const placedId = answer.placed[i];
        const placed = placedId ? bank.get(placedId) : undefined;

        /* Compared by word, not by token: an ayah saying "Allah" twice offers
           two bank entries, and tapping either into either slot is right. */
        const expected = normalizeArabic(question.words[wordIndex].text);
        const given = placed ? normalizeArabic(placed) : "";

        if (given.length > 0 && given === expected) correct++;
        else wrongAt.push(i);
      });

      return { total, correct, hints: clampHints(answer.hints, total), wrongAt };
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

    if (question.kind === "assemble") {
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
