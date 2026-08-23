"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, Eye, Lightbulb, Loader2, RotateCcw, X } from "lucide-react";

import type { Answer } from "@/core/drill/grade";
import type { Drill, Question } from "@/core/drill/types";
import { submitDrill } from "@/app/[locale]/app/practice/actions";
import { PRACTICE_IDLE } from "@/app/[locale]/app/practice/state";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { AssembleQuestion } from "./assemble-question";
import { OrderQuestion } from "./order-question";
import { ChoiceQuestion } from "./choice-question";
import { DrillResult } from "./drill-result";

/**
 * One question at a time, and no way to see the answer without asking for it.
 *
 * The temptation in a revision tool is to show everything and let the reciter
 * judge themselves, which is comfortable and useless — people who have just
 * read a page reliably believe they know it. So a question is answered before
 * it is marked, a hint is a deliberate act that is counted, and the score at
 * the end is arrived at rather than self-reported.
 */
export function DrillRunner({
  drill,
  level,
  nonce,
  names,
}: {
  drill: Drill;
  level: number;
  nonce: string;
  names: Record<number, string>;
}) {
  const t = useTranslations("practice");

  const [state, submit, pending] = useActionState(submitDrill, PRACTICE_IDLE);

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(Answer | null)[]>(() =>
    drill.questions.map(() => null),
  );
  const [hints, setHints] = useState<number[]>(() => drill.questions.map(() => 0));

  /* The clock starts at the first answer, not at render.
     Reading it during render would be impure, and timing from the first real
     interaction is the more honest number anyway — it measures the work, not
     how long the tab sat open. */
  const startedAt = useRef<number | null>(null);

  function startClock() {
    startedAt.current ??= Date.now();
  }

  const question = drill.questions[index];
  const last = index === drill.questions.length - 1;

  const answered = useMemo(
    () => answers.filter((answer) => !isEmpty(answer)).length,
    [answers],
  );

  function setAnswer(next: Answer | null) {
    startClock();
    setAnswers((current) => current.map((a, i) => (i === index ? next : a)));
  }

  function takeHint() {
    startClock();
    setHints((current) => current.map((n, i) => (i === index ? n + 1 : n)));
  }

  /* Hints are folded into the answers only at submission, so a hint taken and
     then a question re-answered still counts — asking for help happened. */
  function payload() {
    return JSON.stringify(
      answers.map((answer, i) => {
        if (!answer) return null;
        if (answer.kind === "assemble") return { ...answer, hints: hints[i] };
        return answer;
      }),
    );
  }

  if (state.status === "ok") {
    return (
      <DrillResult
        drill={drill}
        state={state}
        answers={answers}
        names={names}
        level={level}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Progress
        current={index}
        total={drill.questions.length}
        answered={answered}
        label={t("questionOf", { current: index + 1, total: drill.questions.length })}
      />

      <div key={index} className="animate-rise mt-8 flex-1">
        <QuestionView
          question={question}
          answer={answers[index]}
          onAnswer={setAnswer}
          hints={hints[index]}
          onHint={takeHint}
          names={names}
        />
      </div>

      {state.status === "error" && (
        <p role="alert" className="mt-6 text-center text-sm text-danger">
          {t("saveFailed")}
        </p>
      )}
      {state.status === "notHeld" && (
        <p role="alert" className="mt-6 text-center text-sm text-[var(--text-muted)]">
          {t("notHeld")}
        </p>
      )}

      <form
        /* The answers and the elapsed time are attached here rather than as
           rendered hidden inputs: both read values that must not be touched
           during render. */
        action={(formData) => {
          formData.set("answers", payload());
          formData.set("durationSec", String(elapsedSeconds(startedAt.current)));
          submit(formData);
        }}
        className="mt-8 flex items-center justify-between gap-3 border-t border-[var(--line-subtle)] pt-6"
      >
        <input type="hidden" name="page" value={drill.page} />
        <input type="hidden" name="mode" value={drill.mode} />
        <input type="hidden" name="level" value={level} />
        <input type="hidden" name="nonce" value={nonce} />

        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className={buttonStyles({
            variant: "ghost",
            className: index === 0 ? "invisible" : "",
          })}
        >
          <RotateCcw className="h-4 w-4" />
          {t("back")}
        </button>

        {last ? (
          <button type="submit" disabled={pending} className={buttonStyles({ size: "lg" })}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {pending ? t("marking") : t("finish")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(drill.questions.length - 1, i + 1))}
            className={buttonStyles({ size: "lg", className: "group" })}
          >
            {t("next")}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180" />
          </button>
        )}
      </form>
    </div>
  );
}

function Progress({
  current,
  total,
  answered,
  label,
}: {
  current: number;
  total: number;
  answered: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-500",
              i === current
                ? "bg-[var(--accent)]"
                : i < answered
                  ? "bg-[var(--accent)]/40"
                  : "bg-[var(--line-strong)]",
            )}
          />
        ))}
      </div>
      <span className="shrink-0 text-[0.6875rem] text-[var(--text-faint)] tabular-nums">
        {label}
      </span>
    </div>
  );
}

export function QuestionView({
  question,
  answer,
  onAnswer,
  hints,
  onHint,
  names,
  review,
}: {
  question: Question;
  answer: Answer | null;
  onAnswer: (answer: Answer | null) => void;
  hints: number;
  onHint: () => void;
  names: Record<number, string>;
  /** When set, the question is being shown after marking and is read-only. */
  review?: { wrongAt: number[] };
}) {
  switch (question.kind) {
    case "assemble":
      return (
        <AssembleQuestion
          question={question}
          answer={answer?.kind === "assemble" ? answer : null}
          onAnswer={onAnswer}
          hints={hints}
          onHint={onHint}
          names={names}
          review={review}
        />
      );
    case "choice":
      return (
        <ChoiceQuestion
          question={question}
          answer={answer?.kind === "choice" ? answer : null}
          onAnswer={onAnswer}
          names={names}
          review={review}
        />
      );
    case "order":
      return (
        <OrderQuestion
          question={question}
          answer={answer?.kind === "order" ? answer : null}
          onAnswer={onAnswer}
          names={names}
          review={review}
        />
      );
  }
}

/** The heading every question shares: what is being asked, and of what. */
export function QuestionHeading({
  title,
  hint,
  onHint,
  hints,
  hintLabel,
}: {
  title: string;
  hint?: string;
  onHint?: () => void;
  hints?: number;
  hintLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[0.9375rem] font-medium text-[var(--text-strong)]">{title}</h2>
        {hint && <p className="mt-1 text-[0.8125rem] text-[var(--text-muted)]">{hint}</p>}
      </div>

      {onHint && (
        <button
          type="button"
          onClick={onHint}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--line-strong)] px-3 py-1.5 text-[0.6875rem] font-medium text-[var(--text-muted)] transition-colors duration-300 hover:border-gold-500/50 hover:text-gold-ink"
        >
          <Lightbulb className="h-3.5 w-3.5" />
          {hintLabel}
          {hints ? <span className="tabular-nums opacity-70">· {hints}</span> : null}
        </button>
      )}
    </div>
  );
}

/** "Al-Baqara 2:255", the way a reciter refers to a place. */
export function refLabel(
  ref: { s: number; a: number },
  names: Record<number, string>,
): string {
  return `${names[ref.s] ?? ""} ${ref.s}:${ref.a}`.trim();
}

/** A tick or a cross, once a question has been marked. */
export function Verdict({ correct }: { correct: boolean }) {
  return correct ? (
    <Check className="h-4 w-4 shrink-0 text-[var(--accent)]" strokeWidth={2.5} />
  ) : (
    <X className="h-4 w-4 shrink-0 text-danger" strokeWidth={2.5} />
  );
}

/** A link into the mushaf, for looking something up after getting it wrong. */
export function OpenInMushaf({ page, label }: { page: number; label: string }) {
  return (
    <Link
      href={`/app/quran/${page}`}
      className="inline-flex items-center gap-1.5 text-[0.75rem] text-[var(--text-muted)] underline-offset-4 transition-colors duration-300 hover:text-[var(--accent)] hover:underline"
    >
      <Eye className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}

/** Seconds of actual work, or zero if nothing was ever answered. */
function elapsedSeconds(startedAt: number | null): number {
  if (startedAt === null) return 0;
  return Math.max(0, Math.round((Date.now() - startedAt) / 1000));
}

function isEmpty(answer: Answer | null): boolean {
  if (!answer) return true;
  if (answer.kind === "assemble") return answer.placed.every((id) => id === null);
  if (answer.kind === "choice") return answer.choiceId === null;
  return answer.choiceIds.length === 0;
}
