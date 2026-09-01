"use client";

import { useTranslations } from "next-intl";
import { Undo2 } from "lucide-react";

import type { Answer } from "@/core/drill/grade";
import type { Question } from "@/core/drill/types";
import { cn } from "@/lib/utils";

import { OpenInMushaf, QuestionHeading, Verdict, refLabel } from "./drill-runner";

/**
 * Put the ayahs back in order.
 *
 * Tapping rather than dragging. Drag-and-drop is the obvious design and the
 * wrong one here: it is awkward on a phone, invisible to a screen reader, and
 * this drill is often done one-handed. Tapping in sequence is faster, works
 * everywhere, and needs no explanation.
 */
export function OrderQuestion({
  question,
  answer,
  onAnswer,
  names,
  review,
}: {
  question: Extract<Question, { kind: "order" }>;
  answer: Extract<Answer, { kind: "order" }> | null;
  onAnswer: (answer: Answer | null) => void;
  names: Record<number, string>;
  review?: { wrongAt: number[] };
}) {
  const t = useTranslations("practice");

  const placed = answer?.choiceIds ?? [];
  const byId = new Map(question.shuffled.map((choice) => [choice.id, choice]));
  const remaining = question.shuffled.filter((choice) => !placed.includes(choice.id));

  function place(id: string) {
    onAnswer({ kind: "order", choiceIds: [...placed, id] });
  }

  function undo() {
    onAnswer({ kind: "order", choiceIds: placed.slice(0, -1) });
  }

  return (
    <div>
      <QuestionHeading title={t("modes.shuffle.title")} hint={t("modes.shuffle.hint")} />

      <ol className="mt-8 space-y-2.5">
        {question.answerIds.map((_, position) => {
          const id = placed[position];
          const choice = id ? byId.get(id) : undefined;
          const wrong = review?.wrongAt.includes(position) ?? false;
          const correctId = question.answerIds[position];

          return (
            <li key={position} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[0.75rem] font-medium tabular-nums",
                  choice
                    ? "border-[var(--accent)]/40 text-[var(--accent-strong)]"
                    : "border-dashed border-[var(--line-strong)] text-[var(--text-faint)]",
                )}
              >
                {position + 1}
              </span>

              <div
                className={cn(
                  "min-w-0 flex-1 rounded-2xl border px-4 py-3",
                  !choice && "border-dashed border-[var(--line-strong)]",
                  choice && !review && "border-[var(--accent)]/40 bg-[var(--surface-overlay)]",
                  choice && review && !wrong &&
                    "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]",
                  choice && review && wrong && "border-danger/50 bg-danger/5",
                )}
              >
                {choice ? (
                  <>
                    {/* The reference is withheld until marking: "Al-Baqara 2:3"
                        sitting in slot three would answer the question. */}
                    {review && (
                      <div className="flex items-center gap-2">
                        <Verdict correct={!wrong} />
                        <span className="text-[0.8125rem] text-[var(--text-muted)]">
                          {choice.ref ? refLabel(choice.ref, names) : ""}
                        </span>
                      </div>
                    )}
                    <p
                      dir="rtl"
                      lang="ar"
                      className="font-quran mt-1 text-[1.125rem] leading-relaxed text-[var(--text-strong)]"
                    >
                      {choice.text}
                    </p>
                    {review && wrong && correctId && (
                      <p className="mt-2 border-t border-danger/20 pt-2 text-[0.75rem] text-[var(--text-muted)]">
                        {t("modes.shuffle.shouldBe", {
                          ref: refLabel(byId.get(correctId)?.ref ?? { s: 0, a: 0 }, names),
                        })}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-[0.8125rem] text-[var(--text-faint)]">{t("modes.shuffle.empty")}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {!review && (
        <>
          <div className="mt-7 flex items-center justify-between gap-3">
            <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--text-faint)] uppercase">
              {t("modes.shuffle.pool")}
            </p>
            {placed.length > 0 && (
              <button
                type="button"
                onClick={undo}
                className="inline-flex items-center gap-1.5 text-[0.75rem] text-[var(--text-muted)] transition-colors duration-300 hover:text-[var(--text-strong)]"
              >
                <Undo2 className="h-3.5 w-3.5" />
                {t("modes.shuffle.undo")}
              </button>
            )}
          </div>

          <ul className="mt-3 space-y-2.5">
            {remaining.map((choice) => (
              <li key={choice.id}>
                <button
                  type="button"
                  data-pool-item
                  onClick={() => place(choice.id)}
                  className="w-full rounded-2xl border border-[var(--line-strong)] px-4 py-3 text-start transition-[border-color,background-color] duration-300 ease-[var(--ease-calm)] hover:border-[var(--accent)]/60 hover:bg-[var(--surface-overlay)]"
                >
                  <span
                    dir="rtl"
                    lang="ar"
                    className="font-quran block text-[1.125rem] leading-relaxed text-[var(--text-strong)]"
                  >
                    {choice.text}
                  </span>
                </button>
              </li>
            ))}
            {remaining.length === 0 && (
              <li className="rounded-2xl border border-dashed border-[var(--line-strong)] px-4 py-5 text-center text-[0.8125rem] text-[var(--text-faint)]">
                {t("modes.shuffle.allPlaced")}
              </li>
            )}
          </ul>
        </>
      )}

      {review && (
        <div className="mt-4 flex justify-end">
          <OpenInMushaf page={question.refs[0]?.p ?? 1} label={t("openInMushaf")} />
        </div>
      )}
    </div>
  );
}
