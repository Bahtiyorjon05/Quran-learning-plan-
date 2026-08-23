"use client";

import { useTranslations } from "next-intl";
import { Undo2 } from "lucide-react";

import type { Answer } from "@/core/drill/grade";
import type { Question } from "@/core/drill/types";
import { cn } from "@/lib/utils";

import { OpenInMushaf, QuestionHeading, refLabel } from "./drill-runner";

/**
 * The ayah with words lifted out of it, and a bank to tap them back from.
 *
 * Typing is not an option here. Almost nobody has an Arabic keyboard, and on a
 * phone an Arabic input method turns a thirty-second drill into a fight — so
 * the words are given and the question is which ones, and in what order.
 *
 * That is not a softer question than typing. The bank holds decoys drawn from
 * the passage this ayah is confused with, so recognising the right word is the
 * whole task, and the slots must be filled in reading order.
 */
export function AssembleQuestion({
  question,
  answer,
  onAnswer,
  hints,
  onHint,
  names,
  review,
}: {
  question: Extract<Question, { kind: "assemble" }>;
  answer: Extract<Answer, { kind: "assemble" }> | null;
  onAnswer: (answer: Answer | null) => void;
  hints: number;
  onHint: () => void;
  names: Record<number, string>;
  review?: { wrongAt: number[] };
}) {
  const t = useTranslations("practice");

  const placed = answer?.placed ?? question.blanks.map(() => null);
  const byId = new Map(question.bank.map((word) => [word.id, word.text]));
  const used = new Set(placed.filter(Boolean) as string[]);

  /* The next empty slot, which is where a tapped word goes. */
  const nextSlot = placed.findIndex((id) => id === null);

  function place(id: string) {
    if (nextSlot === -1) return;
    onAnswer({
      kind: "assemble",
      placed: placed.map((current, i) => (i === nextSlot ? id : current)),
    });
  }

  function clearSlot(index: number) {
    onAnswer({ kind: "assemble", placed: placed.map((c, i) => (i === index ? null : c)) });
  }

  function undo() {
    const last = lastFilled(placed);
    if (last !== -1) clearSlot(last);
  }

  /**
   * A hint fills the first empty slot with the word that belongs there.
   *
   * Help, not the answer — and it is counted, so a drill carried entirely by
   * hints does not come out looking like a clean recitation.
   */
  function reveal() {
    if (nextSlot === -1) return;
    const wanted = question.words[question.blanks[nextSlot]].text;
    const match = question.bank.find((word) => word.text === wanted && !used.has(word.id));
    if (!match) return;
    onHint();
    place(match.id);
  }

  const heading =
    question.mode === "gap"
      ? t("gap.title")
      : question.mode === "firstWord"
        ? t("firstWord.title")
        : t("hide.title");

  return (
    <div>
      <QuestionHeading
        title={heading}
        hint={refLabel(question.ref, names)}
        onHint={review ? undefined : reveal}
        hints={hints}
        hintLabel={t("hint")}
      />

      {/* ── the ayah, with slots where words were taken from ── */}
      <div
        dir="rtl"
        lang="ar"
        className="font-arabic mt-7 rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-inset)]/40 p-5 text-[1.4rem] leading-[2.7] sm:p-7 sm:text-[1.65rem] sm:leading-[2.9]"
      >
        {question.words.map((word, wordIndex) => {
          const slot = question.blanks.indexOf(wordIndex);

          if (slot === -1) {
            return (
              <span key={wordIndex} className="text-[var(--text-strong)]">
                {word.text}{" "}
              </span>
            );
          }

          const id = placed[slot];
          const wrong = review?.wrongAt.includes(slot) ?? false;
          const isNext = !review && slot === nextSlot;

          return (
            <button
              key={wordIndex}
              type="button"
              disabled={Boolean(review) || id === null}
              onClick={() => clearSlot(slot)}
              aria-label={
                id ? t("slotFilled", { word: byId.get(id) ?? "" }) : t("slotEmpty", { number: slot + 1 })
              }
              className={cn(
                "mx-1 inline-block min-w-[3.5ch] rounded-lg px-2.5 align-baseline",
                "transition-[background-color,border-color,color] duration-300 ease-[var(--ease-calm)]",
                "border-b-2 disabled:cursor-default",
                review
                  ? wrong
                    ? "border-danger bg-danger/10 text-danger"
                    : "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--accent-strong)]"
                  : id
                    ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] text-[var(--accent-strong)] hover:border-danger hover:text-danger"
                    : isNext
                      ? "animate-pulse border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_6%,transparent)]"
                      : "border-[var(--line-strong)]",
              )}
            >
              {id ? (
                byId.get(id)
              ) : review ? (
                <span className="text-danger/70">{question.words[wordIndex].text}</span>
              ) : (
                <span className="text-transparent select-none">
                  {" ".repeat(Math.max(3, Math.min(9, word.text.length)))}
                </span>
              )}
            </button>
          );
        })}

        {question.truncated && <span className="text-[var(--text-faint)]"> …</span>}
      </div>

      {review ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.8125rem] text-[var(--text-muted)]">
            {review.wrongAt.length === 0
              ? t("allRight")
              : t("missedCount", { count: review.wrongAt.length })}
          </p>
          <OpenInMushaf page={question.ref.p} label={t("openInMushaf")} />
        </div>
      ) : (
        <>
          <div className="mt-7 flex items-center justify-between gap-3">
            <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--text-faint)] uppercase">
              {t("bank")}
            </p>
            {placed.some(Boolean) && (
              <button
                type="button"
                onClick={undo}
                className="inline-flex items-center gap-1.5 text-[0.75rem] text-[var(--text-muted)] transition-colors duration-300 hover:text-[var(--text-strong)]"
              >
                <Undo2 className="h-3.5 w-3.5" />
                {t("shuffle.undo")}
              </button>
            )}
          </div>

          {/* ── the words to choose from ── */}
          <div dir="rtl" lang="ar" className="mt-3 flex flex-wrap gap-2">
            {question.bank.map((word) => {
              const spent = used.has(word.id);
              return (
                <button
                  key={word.id}
                  type="button"
                  disabled={spent || nextSlot === -1}
                  onClick={() => place(word.id)}
                  className={cn(
                    "font-arabic rounded-xl border px-3.5 py-2 text-[1.15rem] leading-snug",
                    "transition-[border-color,background-color,opacity] duration-300 ease-[var(--ease-calm)]",
                    spent
                      ? "border-dashed border-[var(--line-subtle)] text-[var(--text-faint)] opacity-40"
                      : "border-[var(--line-strong)] text-[var(--text-strong)] hover:border-[var(--accent)] hover:bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]",
                    nextSlot === -1 && !spent && "opacity-50",
                  )}
                >
                  {word.text}
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-[0.75rem] text-[var(--text-faint)]">{t("bankHelp")}</p>
        </>
      )}
    </div>
  );
}

function lastFilled(placed: readonly (string | null)[]): number {
  for (let i = placed.length - 1; i >= 0; i--) if (placed[i] !== null) return i;
  return -1;
}
