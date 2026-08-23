"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Undo2 } from "lucide-react";

import { normalizeArabic } from "@/core/quran/arabic";
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
 * whole task, and the slots fill in reading order.
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
  const done = nextSlot === -1;

  function place(id: string) {
    if (done) return;
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
   * A hint fills the next empty slot with the word that belongs there.
   *
   * Help, not the answer — and it is counted, so a drill carried entirely by
   * hints does not come out looking like a clean recitation.
   */
  function reveal() {
    if (done) return;
    const wanted = question.words[question.blanks[nextSlot]].text;
    const match = question.bank.find((word) => word.text === wanted && !used.has(word.id));
    if (!match) return;
    onHint();
    place(match.id);
  }

  /* On a laptop the bank is faster from the keyboard than from the mouse: 1–9
     to place, Backspace to take the last one back. Costs nothing on a phone,
     where no key events arrive.

     Deliberately without a dependency array: the handler closes over `placed`
     and `used`, which change on every tap, so it is re-bound each render and
     always sees the current state. A ref would be the other way to do it, and
     writing one during render is exactly what React forbids. */
  useEffect(() => {
    if (review) return;

    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Backspace") {
        event.preventDefault();
        undo();
        return;
      }

      const digit = Number(event.key);
      if (!Number.isInteger(digit) || digit < 1 || digit > 9) return;

      const word = question.bank[digit - 1];
      if (!word || used.has(word.id)) return;
      event.preventDefault();
      place(word.id);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const heading =
    question.mode === "gap"
      ? t("modes.gap.title")
      : question.mode === "firstWord"
        ? t("modes.firstWord.title")
        : t("modes.hide.title");

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
        className="font-arabic mt-7 rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-inset)]/40 p-5 text-[1.4rem] leading-[2.8] sm:p-7 sm:text-[1.65rem] sm:leading-[3]"
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

          /* After marking, a wrong slot shows both halves: what was chosen and
             what belonged there. Showing only the right answer made it look
             like the reciter's own answer; showing only theirs taught nothing. */
          if (review) {
            return (
              <span key={wordIndex} className="mx-1 inline-block">
                {wrong && (
                  <span className="rounded-lg bg-danger/10 px-2 text-danger line-through decoration-danger/50">
                    {id ? byId.get(id) : t("slotLeftEmpty")}
                  </span>
                )}
                <span
                  className={cn(
                    "rounded-lg px-2",
                    wrong
                      ? "ms-1 bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] text-[var(--accent-strong)]"
                      : "bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--accent-strong)]",
                  )}
                >
                  {word.text}
                </span>
              </span>
            );
          }

          const isNext = slot === nextSlot;

          return (
            <button
              key={wordIndex}
              type="button"
              data-slot
              disabled={id === null}
              onClick={() => clearSlot(slot)}
              aria-label={
                id
                  ? t("slotFilled", { word: byId.get(id) ?? "" })
                  : t("slotEmpty", { number: slot + 1 })
              }
              /* Sized to the word it replaces, measured in letters rather than
                 characters: Uthmani text carries several combining marks per
                 letter that occupy no width, so counting code units made a
                 short word reserve as much room as a long one. */
              style={{ minWidth: `${slotWidth(word.text)}ch` }}
              className={cn(
                "mx-1 inline-block rounded-lg px-2.5 align-baseline",
                "transition-[background-color,border-color,color] duration-300 ease-[var(--ease-calm)]",
                "border-b-2 disabled:cursor-default",
                id
                  ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] text-[var(--accent-strong)] hover:border-danger hover:text-danger"
                  : isNext
                    ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_7%,transparent)]"
                    : "border-dashed border-[var(--line-strong)]",
              )}
            >
              {id ? byId.get(id) : <span aria-hidden>&nbsp;</span>}
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
            <p className="flex items-center gap-2 text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--text-faint)] uppercase">
              {t("bank")}
              <span className="rounded-full bg-[var(--surface-overlay)] px-2 py-0.5 tracking-normal normal-case tabular-nums">
                {placed.filter(Boolean).length}/{question.blanks.length}
              </span>
            </p>
            {placed.some(Boolean) && (
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

          {/* ── the words to choose from ── */}
          <div dir="rtl" lang="ar" className="mt-3 flex flex-wrap gap-2">
            {question.bank.map((word, i) => {
              const spent = used.has(word.id);
              return (
                <button
                  key={word.id}
                  type="button"
                  data-bank-word
                  disabled={spent || done}
                  onClick={() => place(word.id)}
                  className={cn(
                    "group relative rounded-xl border px-3.5 py-2.5",
                    "transition-[border-color,background-color,opacity] duration-300 ease-[var(--ease-calm)]",
                    spent
                      ? "border-dashed border-[var(--line-subtle)] opacity-35"
                      : "border-[var(--line-strong)] hover:border-[var(--accent)] hover:bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]",
                    done && !spent && "opacity-50",
                  )}
                >
                  <span className="font-arabic text-[1.15rem] leading-snug text-[var(--text-strong)]">
                    {word.text}
                  </span>
                  {i < 9 && (
                    <span
                      aria-hidden
                      dir="ltr"
                      className="absolute -top-1.5 -start-1.5 hidden h-4 w-4 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--surface-base)] text-[0.5625rem] text-[var(--text-faint)] tabular-nums lg:grid"
                    >
                      {i + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="mt-4 flex items-center gap-2 text-[0.75rem] text-[var(--text-faint)]">
            <ArrowRight className="h-3.5 w-3.5 shrink-0 rtl:rotate-180" />
            {done ? t("bankDone") : t("bankHelp")}
          </p>
        </>
      )}
    </div>
  );
}

/** How wide an empty slot should be, in ch, from the word it hides. */
function slotWidth(text: string): number {
  const letters = normalizeArabic(text).replace(/\s+/g, "").length;
  return Math.max(3, Math.min(10, Math.round(letters * 1.2)));
}

function lastFilled(placed: readonly (string | null)[]): number {
  for (let i = placed.length - 1; i >= 0; i--) if (placed[i] !== null) return i;
  return -1;
}
