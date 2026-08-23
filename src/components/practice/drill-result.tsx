"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowRight, ChevronDown, RotateCcw, TrendingDown, TrendingUp } from "lucide-react";

import type { Answer } from "@/core/drill/grade";
import type { Drill } from "@/core/drill/types";
import type { PracticeState } from "@/app/[locale]/app/practice/state";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { QuestionView } from "./drill-runner";

/**
 * What the session was worth, and what to do about it.
 *
 * A percentage on its own is a grade, not information. What a reciter needs to
 * know is which passages went wrong and whether the page is now stronger or
 * weaker than before — so the score is shown next to the strength it moved, and
 * every question can be reopened to see exactly where it broke.
 */
export function DrillResult({
  drill,
  state,
  answers,
  names,
  level,
}: {
  drill: Drill;
  state: Extract<PracticeState, { status: "ok" }>;
  answers: (Answer | null)[];
  names: Record<number, string>;
  level: number;
}) {
  const t = useTranslations("practice");
  const [open, setOpen] = useState<number | null>(null);
  const router = useRouter();

  const percent = Math.round((state.correct / Math.max(1, state.total)) * 100);
  const delta = state.strengthAfter - state.strengthBefore;

  /* Progressive hide is the one mode with somewhere to go next: the same page
     again with more of it covered. */
  const nextLevel = drill.mode === "hide" && level < 1 ? Math.min(1, level + 0.25) : null;

  return (
    <div className="animate-rise">
      <div className="rounded-3xl border border-[var(--line-strong)] bg-[var(--surface-overlay)] p-6 text-center sm:p-8">
        <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--text-faint)] uppercase">
          {t(`${drill.mode}.name`)}
        </p>

        <p className="font-[family-name:var(--font-display)] mt-3 text-[3.5rem] leading-none font-light text-[var(--text-strong)] tabular-nums">
          {percent}
          <span className="text-[1.5rem] text-[var(--text-faint)]">%</span>
        </p>

        <p className="mt-2 text-[0.9375rem] text-[var(--text-muted)]">
          {t("scoreLine", { correct: state.correct, total: state.total })}
          {state.hints > 0 && <> · {t("hintsUsed", { count: state.hints })}</>}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <StrengthPill before={state.strengthBefore} after={state.strengthAfter} delta={delta} />
        </div>

        {state.lapsed && (
          <p className="mt-5 inline-flex items-start gap-2 rounded-xl border border-gold-500/30 bg-gold-500/10 px-4 py-3 text-start text-[0.8125rem] text-gold-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {state.needsRelearning ? t("relearning") : t("lapsed")}
            </span>
          </p>
        )}
      </div>

      <h3 className="mt-9 text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--text-faint)] uppercase">
        {t("review")}
      </h3>

      <ul className="mt-3 space-y-2">
        {drill.questions.map((question, i) => {
          const wrongAt = state.wrongAt[i] ?? [];
          const clean = wrongAt.length === 0;
          const expanded = open === i;

          return (
            <li
              key={i}
              className={cn(
                "overflow-hidden rounded-2xl border transition-[border-color] duration-300",
                clean ? "border-[var(--line-subtle)]" : "border-danger/35",
              )}
            >
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : i)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors duration-300 hover:bg-[var(--surface-overlay)]"
              >
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    clean ? "bg-[var(--accent)]" : "bg-danger",
                  )}
                />
                <span className="min-w-0 flex-1 text-[0.875rem] text-[var(--text-strong)]">
                  {t("questionNumber", { number: i + 1 })}
                  <span className="ms-2 text-[var(--text-muted)]">
                    {clean ? t("allRight") : t("missedCount", { count: wrongAt.length })}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-[var(--text-faint)] transition-transform duration-300",
                    expanded && "rotate-180",
                  )}
                />
              </button>

              {expanded && (
                <div className="animate-rise border-t border-[var(--line-subtle)] p-4 sm:p-5">
                  <QuestionView
                    question={question}
                    answer={answers[i] ?? null}
                    onAnswer={() => {}}
                    hints={0}
                    onHint={() => {}}
                    names={names}
                    review={{ wrongAt }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line-subtle)] pt-6">
        <Link href="/app/practice" className={buttonStyles({ variant: "ghost" })}>
          <RotateCcw className="h-4 w-4" />
          {t("choosePage")}
        </Link>

        {nextLevel !== null ? (
          <Link
            href={`/app/practice/${drill.page}?mode=hide&level=${nextLevel}`}
            className={buttonStyles({ size: "lg", className: "group" })}
          >
            {t("hide.harder")}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180" />
          </Link>
        ) : (
          <button
            type="button"
            /* A fresh nonce means a fresh drill on the same page. Generated on
               click rather than in the href, which would produce a new value on
               every render. */
            onClick={() => router.push(`/app/practice/${drill.page}?n=${Date.now()}`)}
            className={buttonStyles({ size: "lg", className: "group" })}
          >
            {t("again")}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180" />
          </button>
        )}
      </div>
    </div>
  );
}

function StrengthPill({
  before,
  after,
  delta,
}: {
  before: number;
  after: number;
  delta: number;
}) {
  const t = useTranslations("practice");
  const up = delta > 0;
  const flat = delta === 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-medium",
        flat
          ? "border-[var(--line-strong)] text-[var(--text-muted)]"
          : up
            ? "border-[var(--accent)]/40 bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] text-[var(--accent-strong)]"
            : "border-danger/40 bg-danger/5 text-danger",
      )}
    >
      {!flat && (up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />)}
      <span className="tabular-nums">
        {t("strength")} {before} → {after}
      </span>
    </span>
  );
}
