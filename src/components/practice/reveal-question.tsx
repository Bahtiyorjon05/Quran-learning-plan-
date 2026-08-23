"use client";

import { useTranslations } from "next-intl";

import type { Answer } from "@/core/drill/grade";
import type { Question } from "@/core/drill/types";
import { cn } from "@/lib/utils";

import { OpenInMushaf, QuestionHeading, refLabel } from "./drill-runner";

/**
 * The ayah with words taken out of it.
 *
 * The blanks sit in the line rather than in a list below it, because the shape
 * of the line is half of what a hafiz remembers — a gap in the middle of a
 * remembered rhythm is a different question from the fifth item in a form.
 *
 * The inputs size themselves to the word they are hiding, which gives away
 * length. That is deliberate: this mode is about recall in context, and the
 * mode that gives nothing away is the first-word prompt.
 */
export function RevealQuestion({
  question,
  answer,
  onAnswer,
  hints,
  onHint,
  names,
  review,
}: {
  question: Extract<Question, { kind: "reveal" }>;
  answer: Extract<Answer, { kind: "reveal" }> | null;
  onAnswer: (answer: Answer | null) => void;
  hints: number;
  onHint: () => void;
  names: Record<number, string>;
  review?: { wrongAt: number[] };
}) {
  const t = useTranslations("practice");
  const words = answer?.words ?? question.blanks.map(() => "");

  function setWord(blankIndex: number, value: string) {
    const next = question.blanks.map((_, i) => (i === blankIndex ? value : (words[i] ?? "")));
    onAnswer({ kind: "reveal", words: next });
  }

  /* One hint fills the first blank still empty — help, not the answer. */
  function reveal() {
    const target = question.blanks.findIndex((_, i) => (words[i] ?? "").trim() === "");
    if (target === -1) return;
    onHint();
    setWord(target, question.words[question.blanks[target]].text);
  }

  return (
    <div>
      <QuestionHeading
        title={question.mode === "gap" ? t("gap.title") : t("hide.title")}
        hint={refLabel(question.ref, names)}
        onHint={review ? undefined : reveal}
        hints={hints}
        hintLabel={t("hint")}
      />

      <div
        dir="rtl"
        lang="ar"
        className="font-arabic mt-8 rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-inset)]/40 p-5 text-[1.5rem] leading-[2.6] sm:p-7 sm:text-[1.75rem] sm:leading-[2.8]"
      >
        {question.words.map((word, wordIndex) => {
          const blankIndex = question.blanks.indexOf(wordIndex);
          if (blankIndex === -1) {
            return (
              <span key={wordIndex} className="text-[var(--text-strong)]">
                {word.text}{" "}
              </span>
            );
          }

          const wrong = review?.wrongAt.includes(blankIndex) ?? false;
          const value = words[blankIndex] ?? "";

          if (review) {
            return (
              <span
                key={wordIndex}
                className={cn(
                  "mx-1 inline-block rounded-lg px-2",
                  wrong
                    ? "bg-danger/10 text-danger line-through decoration-danger/40"
                    : "bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--accent-strong)]",
                )}
              >
                {wrong ? (value.trim() || t("blank")) : word.text}
              </span>
            );
          }

          return (
            <input
              key={wordIndex}
              value={value}
              onChange={(event) => setWord(blankIndex, event.target.value)}
              aria-label={t("blankNumber", { number: blankIndex + 1 })}
              dir="rtl"
              lang="ar"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              /* Sized to the word it replaces: the length of a line is part of
                 what is remembered, and a uniform box would hide it. */
              style={{ width: `${Math.max(3, word.text.length * 0.72)}ch` }}
              className={cn(
                "font-arabic mx-1 inline-block border-b-2 bg-transparent text-center align-baseline",
                "text-[1.5rem] leading-tight text-[var(--accent-strong)] sm:text-[1.75rem]",
                "focus:outline-none",
                value.trim()
                  ? "border-[var(--accent)]"
                  : "border-[var(--line-strong)] focus:border-[var(--accent)]",
              )}
            />
          );
        })}
      </div>

      {review && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.8125rem] text-[var(--text-muted)]">
            {review.wrongAt.length === 0 ? t("allRight") : t("missedCount", { count: review.wrongAt.length })}
          </p>
          <OpenInMushaf page={question.ref.p} label={t("openInMushaf")} />
        </div>
      )}
    </div>
  );
}
