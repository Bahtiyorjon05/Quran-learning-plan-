"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, Check, Loader2, TriangleAlert } from "lucide-react";

import { amendDeadline } from "@/app/[locale]/app/plan/amend/actions";
import { AMEND_IDLE } from "@/core/plan/amend-state";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Pulling a deadline in, with the cost shown before it is agreed to.
 *
 * The number that matters is not the date but what the date does to a morning:
 * moving a three-year covenant in by six months is eight lines a day becoming
 * eleven. That is worked out as the date is picked, from the same arithmetic
 * the dashboard uses, so nobody agrees to a pace they have not seen.
 */
export function AmendForm({
  currentEndDate,
  earliest,
  remainingLines,
  currentDailyLines,
  studyDaysMask,
}: {
  currentEndDate: string;
  /** Tomorrow, in the reader's own zone. */
  earliest: string;
  remainingLines: number;
  currentDailyLines: number;
  studyDaysMask: number;
}) {
  const t = useTranslations("amend");
  const [state, action, pending] = useActionState(amendDeadline, AMEND_IDLE);
  const [chosen, setChosen] = useState("");

  /* Study days between now and the chosen date, counted the way the plan
     counts them: only the weekdays the covenant actually uses. */
  const preview = (() => {
    if (!chosen || chosen >= currentEndDate || chosen < earliest) return null;

    let days = 0;
    const cursor = new Date(`${earliest}T00:00:00Z`);
    const end = new Date(`${chosen}T00:00:00Z`);
    while (cursor <= end) {
      if (studyDaysMask & (1 << cursor.getUTCDay())) days += 1;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return { days, lines: days > 0 ? Math.ceil(remainingLines / days) : remainingLines };
  })();

  if (state.status === "done") {
    return (
      <div className="panel rounded-3xl p-6 text-center sm:p-8">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[var(--accent)]/40 bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]">
          <Check className="h-5 w-5 text-[var(--accent-strong)]" strokeWidth={2.2} />
        </span>
        <p className="mt-4 text-[1.0625rem] text-[var(--text-strong)]">{t("done")}</p>
        <Link href="/app" className={buttonStyles({ className: "mt-6" })}>
          {t("back")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <div className="panel rounded-3xl p-5 sm:p-6">
        <label
          htmlFor="newEndDate"
          className="block text-[0.9375rem] font-medium text-[var(--text-strong)]"
        >
          {t("newDate")}
        </label>
        <p className="mt-1 text-[0.8125rem] text-[var(--text-muted)]">{t("newDateHint")}</p>

        <div className="mt-4 flex items-center gap-3">
          <CalendarDays className="h-4.5 w-4.5 shrink-0 text-[var(--text-faint)]" strokeWidth={1.7} />
          <input
            id="newEndDate"
            name="newEndDate"
            type="date"
            required
            min={earliest}
            /* The day before the current deadline: the browser refuses a later
               one before the server has to. */
            max={new Date(new Date(`${currentEndDate}T00:00:00Z`).getTime() - 86_400_000)
              .toISOString()
              .slice(0, 10)}
            value={chosen}
            onChange={(event) => setChosen(event.target.value)}
            className="h-11 flex-1 rounded-xl border border-[var(--line-strong)] bg-[var(--surface-inset)]/60 px-4 text-[0.9375rem] text-[var(--text-strong)] tabular-nums transition-colors duration-300 focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        {preview && (
          <div className="mt-5 border-t border-[var(--line-subtle)] pt-4">
            <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-[var(--text-faint)] uppercase">
              {t("costTitle")}
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-[1.5rem] leading-tight font-light text-[var(--text-strong)]">
              {t("costLines", { lines: preview.lines, current: currentDailyLines })}
            </p>
            <p className="mt-1 text-[0.8125rem] text-[var(--text-muted)] tabular-nums">
              {t("costDays", { days: preview.days })}
            </p>
          </div>
        )}
      </div>

      {/* Said before the button, not after it. */}
      <div className="rounded-2xl border border-gold-500/35 bg-gold-500/[0.06] p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-gold-ink">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {t("onceTitle")}
        </p>
        <p className="mt-2 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
          {t("onceBody")}
        </p>
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-[0.875rem] text-danger">
          {state.reason === "later"
            ? t("errorLater")
            : state.reason === "past"
              ? t("errorPast")
              : state.reason === "spent"
                ? t("errorSpent")
                : t("errorFailed")}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !preview}
        className={cn(buttonStyles({ size: "lg" }), "w-full")}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {pending ? t("confirming") : t("confirm")}
      </button>
    </form>
  );
}
