"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { Answer } from "@/core/drill/grade";
import type { Question } from "@/core/drill/types";
import { cn } from "@/lib/utils";

import { OpenInMushaf, QuestionHeading, refLabel } from "./drill-runner";

/**
 * An opening, and the rest from memory.
 *
 * The hardest of the modes and the closest to actually reciting. Typing a whole
 * ayah in Arabic is slow on a phone, so the marking is forgiving — the grader
 * compares the skeleton and passes anything above the recall threshold — and
 * there is a self-marked path for anyone who would rather recite aloud, which
 * is after all what hifz is.
 */
export function RecallQuestion({
  question,
  answer,
  onAnswer,
  hints,
  onHint,
  names,
  review,
}: {
  question: Extract<Question, { kind: "recall" }>;
  answer: Extract<Answer, { kind: "recall" }> | null;
  onAnswer: (answer: Answer | null) => void;
  hints: number;
  onHint: () => void;
  names: Record<number, string>;
  review?: { wrongAt: number[] };
}) {
  const t = useTranslations("practice");
  const [revealed, setRevealed] = useState(false);

  const text = answer?.text ?? "";

  /* The hint shows the next few words, not the whole ayah: enough to unstick a
     memory without replacing it. */
  function peek() {
    onHint();
    setRevealed(true);
  }

  const peekWords = question.answer.split(/\s+/).slice(0, 3).join(" ");

  return (
    <div>
      <QuestionHeading
        title={t("firstWord.title")}
        hint={refLabel(question.ref, names)}
        onHint={review ? undefined : peek}
        hints={hints}
        hintLabel={t("hint")}
      />

      <p
        dir="rtl"
        lang="ar"
        className="font-arabic mt-8 rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-inset)]/40 px-5 py-6 text-center text-[1.75rem] leading-relaxed text-[var(--text-strong)] sm:text-[2rem]"
      >
        {question.prompt}
        <span className="text-[var(--text-faint)]"> …</span>
      </p>

      {revealed && !review && (
        <p
          dir="rtl"
          lang="ar"
          className="font-arabic animate-rise mt-3 text-center text-[1.25rem] text-gold-ink"
        >
          {peekWords} …
        </p>
      )}

      {review ? (
        <div className="mt-6 space-y-4">
          <Panel
            label={t("youRecited")}
            tone={review.wrongAt.length === 0 ? "right" : "wrong"}
            text={text.trim() || t("blank")}
          />
          <Panel label={t("theAyah")} tone="neutral" text={question.answer} />
          <div className="flex justify-end">
            <OpenInMushaf page={question.ref.p} label={t("openInMushaf")} />
          </div>
        </div>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(event) => onAnswer({ kind: "recall", text: event.target.value })}
            dir="rtl"
            lang="ar"
            rows={3}
            placeholder={t("firstWord.placeholder")}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="font-arabic mt-6 w-full resize-y rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-inset)]/40 px-5 py-4 text-[1.25rem] leading-loose text-[var(--text-strong)] transition-colors duration-300 focus:border-[var(--accent)] focus:outline-none"
          />
          <p className="mt-3 text-[0.75rem] text-[var(--text-faint)]">{t("firstWord.forgiving")}</p>
        </>
      )}
    </div>
  );
}

function Panel({
  label,
  text,
  tone,
}: {
  label: string;
  text: string;
  tone: "right" | "wrong" | "neutral";
}) {
  return (
    <div>
      <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--text-faint)] uppercase">
        {label}
      </p>
      <p
        dir="rtl"
        lang="ar"
        className={cn(
          "font-arabic mt-2 rounded-2xl border px-5 py-4 text-[1.25rem] leading-loose",
          tone === "right" &&
            "border-[var(--accent)]/40 bg-[color-mix(in_oklab,var(--accent)_8%,transparent)] text-[var(--text-strong)]",
          tone === "wrong" && "border-danger/40 bg-danger/5 text-[var(--text-strong)]",
          tone === "neutral" && "border-[var(--line-strong)] text-[var(--text-strong)]",
        )}
      >
        {text}
      </p>
    </div>
  );
}
