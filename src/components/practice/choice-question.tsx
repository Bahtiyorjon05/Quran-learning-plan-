"use client";

import { useTranslations } from "next-intl";

import type { Answer } from "@/core/drill/grade";
import type { Question } from "@/core/drill/types";
import { cn } from "@/lib/utils";

import { OpenInMushaf, QuestionHeading, Verdict, refLabel } from "./drill-runner";

/**
 * Multiple choice, for the two questions where it is the honest format.
 *
 * "What comes next" and the mutashabihat duel are both really the same
 * question — *which of these places is this* — and that question has a small
 * set of genuinely plausible answers. Offering them is not making it easier;
 * the distractors are the confusable twins, so a reciter who has not
 * distinguished them will choose wrong.
 *
 * The duel shows references rather than text, because the passage is already on
 * screen and repeating it as an option would answer the question.
 */
export function ChoiceQuestion({
  question,
  answer,
  onAnswer,
  names,
  review,
}: {
  question: Extract<Question, { kind: "choice" }>;
  answer: Extract<Answer, { kind: "choice" }> | null;
  onAnswer: (answer: Answer | null) => void;
  names: Record<number, string>;
  review?: { wrongAt: number[] };
}) {
  const t = useTranslations("practice");
  const chosen = answer?.choiceId ?? null;
  const duel = question.mode === "mutashabihat";

  return (
    <div>
      <QuestionHeading
        title={duel ? t("mutashabihat.title") : t("next.title")}
        hint={duel ? t("mutashabihat.hint") : refLabel(question.ref, names)}
      />

      <p
        dir="rtl"
        lang="ar"
        className={cn(
          "font-arabic mt-8 rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-inset)]/40 px-5 py-6 text-[var(--text-strong)]",
          duel
            ? "text-center text-[1.5rem] leading-loose sm:text-[1.75rem]"
            : "text-[1.375rem] leading-loose",
        )}
      >
        {question.prompt}
      </p>

      <ul className="mt-5 space-y-2.5">
        {question.choices.map((choice) => {
          const selected = chosen === choice.id;
          const isAnswer = choice.id === question.answerId;

          /* After marking, the right answer is always shown as right — being
             told only that you were wrong teaches nothing. */
          const tone = review
            ? isAnswer
              ? "right"
              : selected
                ? "wrong"
                : "idle"
            : selected
              ? "selected"
              : "idle";

          return (
            <li key={choice.id}>
              <button
                type="button"
                disabled={Boolean(review)}
                onClick={() => onAnswer({ kind: "choice", choiceId: choice.id })}
                aria-pressed={selected}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-start",
                  "transition-[border-color,background-color] duration-300 ease-[var(--ease-calm)]",
                  tone === "idle" &&
                    "border-[var(--line-strong)] hover:border-[var(--text-faint)] disabled:hover:border-[var(--line-strong)]",
                  tone === "selected" &&
                    "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]",
                  tone === "right" &&
                    "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]",
                  tone === "wrong" && "border-danger/50 bg-danger/5",
                )}
              >
                {review && (selected || isAnswer) && <Verdict correct={isAnswer} />}

                <span className="min-w-0 flex-1">
                  {choice.ref && (
                    <span
                      className={cn(
                        "block text-[0.9375rem] font-medium",
                        duel ? "text-[var(--text-strong)]" : "text-[var(--text-muted)]",
                      )}
                    >
                      {refLabel(choice.ref, names)}
                    </span>
                  )}
                  {choice.text && (
                    <span
                      dir="rtl"
                      lang="ar"
                      className="font-arabic mt-1 block text-[1.125rem] leading-relaxed text-[var(--text-strong)]"
                    >
                      {choice.text}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {review && (
        <div className="mt-4 flex justify-end">
          <OpenInMushaf page={question.ref.p} label={t("openInMushaf")} />
        </div>
      )}
    </div>
  );
}
