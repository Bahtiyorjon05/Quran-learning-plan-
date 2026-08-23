"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Check, Lock, ScrollText } from "lucide-react";

import { addMonths, diffDays, type CivilDate } from "@/core/date/civil";
import { TOTAL_JUZ } from "@/core/quran/mushaf";
import {
  EVERY_DAY,
  MAX_DAILY_LINES,
  planFromDailyLines,
  planFromDeadline,
  resolveScope,
  studyDaysPerWeek,
  type PlanScope,
} from "@/core/plan/schedule";
import { NEW_PLAN_IDLE, type NewPlanState } from "@/core/plan/wizard-state";
import { createCovenant } from "@/app/[locale]/app/plan/new/actions";
import { localeTag, type Locale } from "@/i18n/routing";
import { buttonStyles } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const STEPS = ["niyyah", "scope", "pace", "rhythm", "sign"] as const;
type Step = (typeof STEPS)[number];

const MIN_MONTHS = 3;
const MAX_MONTHS = 120;

export function CovenantWizard({ today }: { today: CivilDate }) {
  const t = useTranslations("plan");
  const locale = useLocale() as Locale;
  const format = useFormatter();

  const [state, submit, pending] = useActionState<NewPlanState, FormData>(
    createCovenant,
    NEW_PLAN_IDLE,
  );

  const [step, setStep] = useState<Step>("niyyah");
  const [niyyah, setNiyyah] = useState("");
  const [scopeKind, setScopeKind] = useState<"full" | "juzRange">("full");
  const [fromJuz, setFromJuz] = useState(1);
  const [toJuz, setToJuz] = useState(TOTAL_JUZ);
  const [months, setMonths] = useState(36);
  const [mask, setMask] = useState(EVERY_DAY);
  const [rukhsah, setRukhsah] = useState(12);

  const scope: PlanScope = useMemo(
    () =>
      scopeKind === "full"
        ? { kind: "full" }
        : { kind: "juzRange", fromJuz: Math.min(fromJuz, toJuz), toJuz: Math.max(fromJuz, toJuz) },
    [scopeKind, fromJuz, toJuz],
  );

  const resolved = useMemo(() => resolveScope(scope), [scope]);
  const endDate = useMemo(() => addMonths(today, months), [today, months]);

  /* The same engine the server will use. This is a preview, not the decision —
     the action recomputes everything before anything is written. */
  const shape = useMemo(() => {
    try {
      return planFromDeadline({ scope, startDate: today, endDate, studyDaysMask: mask });
    } catch {
      return null;
    }
  }, [scope, today, endDate, mask]);

  /* Turning the dial from the other end: a daily portion implies a duration. */
  function setDailyLines(lines: number) {
    const clamped = Math.max(1, Math.min(lines, MAX_DAILY_LINES));
    try {
      const derived = planFromDailyLines({
        scope,
        startDate: today,
        dailyLines: clamped,
        studyDaysMask: mask,
      });
      const impliedMonths = Math.max(
        MIN_MONTHS,
        Math.min(MAX_MONTHS, Math.round(diffDays(today, derived.endDate) / 30.44)),
      );
      setMonths(impliedMonths);
    } catch {
      /* An unreachable combination just leaves the dial where it was. */
    }
  }

  const weekdayNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(localeTag[locale], { weekday: "short" });
    // 1970-01-04 was a Sunday, matching bit 0 of the mask.
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(Date.UTC(1970, 0, 4 + i))),
    );
  }, [locale]);

  const index = STEPS.indexOf(step);
  const tooFast = (shape?.dailyLines ?? 0) > MAX_DAILY_LINES;
  const canAdvance =
    step === "rhythm" ? studyDaysPerWeek(mask) > 0 && !tooFast : !tooFast;

  const intensity =
    !shape ? "gentle"
    : shape.dailyPages <= 0.5 ? "gentle"
    : shape.dailyPages <= 1 ? "steady"
    : shape.dailyPages <= 3 ? "ambitious"
    : "intense";

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* ── Progress ── */}
      <ol className="flex items-center gap-1.5" aria-label={t("new.title")}>
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 flex-col gap-2">
            <span
              className={cn(
                "h-1 rounded-full transition-colors duration-500",
                i <= index ? "bg-[var(--accent)]" : "bg-[var(--line-strong)]",
              )}
            />
            <span
              className={cn(
                "hidden text-[0.6875rem] tracking-wide sm:block",
                i === index ? "text-[var(--text-strong)]" : "text-[var(--text-faint)]",
              )}
            >
              {t(`new.steps.${s}`)}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-[var(--text-faint)] sm:hidden">
        {t("new.stepOf", { current: index + 1, total: STEPS.length })}
      </p>

      <div className="animate-rise mt-10" key={step}>
        <h1 className="font-[family-name:var(--font-display)] text-[1.875rem] leading-tight font-light text-[var(--text-strong)] sm:text-[2.25rem]">
          {t(`${step}.title`)}
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
          {t(`${step}.subtitle`)}
        </p>

        <div className="mt-8">
          {/* ── 1. Niyyah ────────────────────────────────────────────────── */}
          {step === "niyyah" && (
            <div>
              <label
                htmlFor="niyyah"
                className="text-[0.8125rem] font-medium text-[var(--text-default)]"
              >
                {t("niyyah.label")}
              </label>
              <textarea
                id="niyyah"
                value={niyyah}
                onChange={(e) => setNiyyah(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder={t("niyyah.placeholder")}
                className="mt-2 w-full resize-none rounded-xl border border-[var(--line-strong)] bg-[var(--surface-inset)]/60 px-4 py-3 text-[0.9375rem] leading-relaxed text-[var(--text-strong)] placeholder:text-[var(--text-faint)] transition-[border-color,box-shadow] duration-300 focus:border-[var(--accent)] focus:ring-4 focus:ring-[color-mix(in_oklab,var(--accent)_18%,transparent)] focus:outline-none"
              />
              <p className="mt-2 text-[0.8125rem] text-[var(--text-faint)]">
                {t("niyyah.hint")}
              </p>
            </div>
          )}

          {/* ── 2. Scope ─────────────────────────────────────────────────── */}
          {step === "scope" && (
            <div className="space-y-3">
              <ScopeCard
                selected={scopeKind === "full"}
                onSelect={() => setScopeKind("full")}
                title={t("scope.full")}
                description={t("scope.fullDesc")}
              />
              <ScopeCard
                selected={scopeKind === "juzRange" && fromJuz === 30 && toJuz === 30}
                onSelect={() => {
                  setScopeKind("juzRange");
                  setFromJuz(30);
                  setToJuz(30);
                }}
                title={t("scope.juzAmma")}
                description={t("scope.juzAmmaDesc")}
              />
              <ScopeCard
                selected={scopeKind === "juzRange" && fromJuz === 1 && toJuz === 15}
                onSelect={() => {
                  setScopeKind("juzRange");
                  setFromJuz(1);
                  setToJuz(15);
                }}
                title={t("scope.firstHalf")}
                description={t("scope.firstHalfDesc")}
              />

              <ScopeCard
                selected={
                  scopeKind === "juzRange" &&
                  !(fromJuz === 30 && toJuz === 30) &&
                  !(fromJuz === 1 && toJuz === 15)
                }
                onSelect={() => {
                  setScopeKind("juzRange");
                  setFromJuz(1);
                  setToJuz(10);
                }}
                title={t("scope.juzRange")}
                description={t("scope.juzRangeDesc")}
              >
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <JuzSelect
                    label={t("scope.fromJuz")}
                    value={fromJuz}
                    onChange={(v) => {
                      setFromJuz(v);
                      if (v > toJuz) setToJuz(v);
                    }}
                  />
                  <JuzSelect
                    label={t("scope.toJuz")}
                    value={toJuz}
                    onChange={(v) => {
                      setToJuz(v);
                      if (v < fromJuz) setFromJuz(v);
                    }}
                  />
                </div>
              </ScopeCard>

              <p className="pt-2 text-center text-sm text-[var(--text-muted)] tabular-nums">
                {t("scope.summary", {
                  pages: resolved.toPage - resolved.fromPage + 1,
                  lines: resolved.totalLines,
                })}
              </p>
            </div>
          )}

          {/* ── 3. Pace ──────────────────────────────────────────────────── */}
          {step === "pace" && shape && (
            <div className="space-y-7">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[0.8125rem] font-medium text-[var(--text-default)]">
                    {t("pace.duration")}
                  </span>
                  <span className="text-sm text-[var(--text-strong)] tabular-nums">
                    {months % 12 === 0
                      ? t("pace.years", { count: months / 12 })
                      : months < 12
                        ? t("pace.months", { count: months })
                        : t("pace.yearsAndMonths", {
                            years: Math.floor(months / 12),
                            months: months % 12,
                          })}
                  </span>
                </div>
                <input
                  type="range"
                  min={MIN_MONTHS}
                  max={MAX_MONTHS}
                  step={1}
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                  aria-label={t("pace.duration")}
                  className="mt-3 w-full accent-[var(--accent-ground)]"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {[12, 24, 36, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMonths(m)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs transition-colors",
                        months === m
                          ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-[var(--accent-strong)]"
                          : "border-[var(--line-strong)] text-[var(--text-muted)] hover:text-[var(--text-strong)]",
                      )}
                    >
                      {t("pace.years", { count: m / 12 })}
                    </button>
                  ))}
                </div>
              </div>

              {/* The live answer — the whole point of the step. */}
              <div className="rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-raised)]/60 p-5">
                <p className="text-xs text-[var(--text-muted)]">{t("pace.finishBy")}</p>
                <p className="mt-1 font-[family-name:var(--font-display)] text-[1.75rem] leading-none font-light text-[var(--text-strong)] sm:text-[2rem]">
                  {format.dateTime(new Date(`${shape.endDate}T00:00:00Z`), {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </p>

                <div className="mt-5 flex items-end justify-between gap-4 border-t border-[var(--line-subtle)] pt-4">
                  <div>
                    <p className="font-[family-name:var(--font-display)] text-2xl font-light text-[var(--accent-strong)] tabular-nums">
                      {t("pace.perDay", { lines: shape.dailyLines })}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-faint)] tabular-nums">
                      {t("pace.aboutPages", { pages: shape.dailyPages.toFixed(1) })} ·{" "}
                      {t("pace.studyDays", { count: shape.studyDays })}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-[var(--line-strong)] px-2.5 py-1 text-[0.6875rem] text-[var(--text-muted)]">
                    {t(`pace.${intensity}`)}
                  </span>
                </div>
              </div>

              <div>
                <label
                  htmlFor="dailyLines"
                  className="text-[0.8125rem] font-medium text-[var(--text-default)]"
                >
                  {t("pace.byDose")}
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <Stepper
                    label={t("pace.dailyLines")}
                    value={shape.dailyLines}
                    min={1}
                    max={MAX_DAILY_LINES}
                    onChange={setDailyLines}
                  />
                  <span className="text-sm text-[var(--text-faint)]">
                    {t("pace.dailyLines")}
                  </span>
                </div>
              </div>

              {tooFast && <FormError>{t("pace.tooFast")}</FormError>}
            </div>
          )}

          {/* ── 4. Rhythm ────────────────────────────────────────────────── */}
          {step === "rhythm" && (
            <div className="space-y-8">
              <div>
                <p className="text-[0.8125rem] font-medium text-[var(--text-default)]">
                  {t("rhythm.studyDays")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {weekdayNames.map((name, bit) => {
                    const on = (mask & (1 << bit)) !== 0;
                    return (
                      <button
                        key={bit}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setMask(mask ^ (1 << bit))}
                        className={cn(
                          "min-w-12 flex-1 rounded-xl border px-2 py-2.5 text-sm capitalize transition-colors",
                          on
                            ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-[var(--accent-strong)]"
                            : "border-[var(--line-strong)] text-[var(--text-faint)] hover:text-[var(--text-muted)]",
                        )}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
                {studyDaysPerWeek(mask) === 0 ? (
                  <p role="alert" className="mt-2 text-[0.8125rem] text-danger">
                    {t("rhythm.noDays")}
                  </p>
                ) : (
                  shape && (
                    <p className="mt-3 text-[0.8125rem] text-[var(--text-faint)] tabular-nums">
                      {t("pace.perDay", { lines: shape.dailyLines })} ·{" "}
                      {t("pace.studyDays", { count: shape.studyDays })}
                    </p>
                  )
                )}
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[0.8125rem] font-medium text-[var(--text-default)]">
                    {t("rhythm.rukhsah")}
                  </span>
                  <span className="text-sm text-[var(--text-strong)] tabular-nums">
                    {rukhsah === 0
                      ? t("rhythm.rukhsahNone")
                      : t("rhythm.rukhsahValue", { count: rukhsah })}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={24}
                  step={1}
                  value={rukhsah}
                  onChange={(e) => setRukhsah(Number(e.target.value))}
                  aria-label={t("rhythm.rukhsah")}
                  className="mt-3 w-full accent-[var(--accent-ground)]"
                />
                <p className="mt-3 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
                  {t("rhythm.rukhsahHint")}
                </p>
                <p className="mt-2 flex items-start gap-2 text-[0.8125rem] text-gold-ink">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {t("rhythm.rukhsahFixed")}
                </p>
              </div>
            </div>
          )}

          {/* ── 5. Sign ──────────────────────────────────────────────────── */}
          {step === "sign" && shape && (
            <form action={submit} className="space-y-6">
              <input type="hidden" name="niyyah" value={niyyah} />
              <input type="hidden" name="scopeKind" value={scopeKind} />
              <input type="hidden" name="fromJuz" value={scope.kind === "juzRange" ? scope.fromJuz : 1} />
              <input type="hidden" name="toJuz" value={scope.kind === "juzRange" ? scope.toJuz : TOTAL_JUZ} />
              <input type="hidden" name="endDate" value={shape.endDate} />
              <input type="hidden" name="studyDaysMask" value={mask} />
              <input type="hidden" name="rukhsahBudget" value={rukhsah} />

              {state.status === "error" && (
                <FormError>{t(`errors.${state.reason}`)}</FormError>
              )}

              <dl className="overflow-hidden rounded-2xl border border-[var(--line-strong)]">
                <Row
                  label={t("sign.scope")}
                  value={
                    scopeKind === "full"
                      ? t("scope.full")
                      : `${t("scope.fromJuz")} ${scope.kind === "juzRange" ? scope.fromJuz : 1} – ${scope.kind === "juzRange" ? scope.toJuz : 30}`
                  }
                />
                <Row
                  label={t("sign.finishBy")}
                  value={format.dateTime(new Date(`${shape.endDate}T00:00:00Z`), {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                  emphasis
                />
                <Row
                  label={t("sign.daily")}
                  value={t("pace.perDay", { lines: shape.dailyLines })}
                />
                <Row
                  label={t("sign.days")}
                  value={
                    studyDaysPerWeek(mask) === 7
                      ? t("rhythm.everyDay")
                      : weekdayNames.filter((_, b) => mask & (1 << b)).join(", ")
                  }
                />
                <Row
                  label={t("sign.rukhsah")}
                  value={
                    rukhsah === 0
                      ? t("rhythm.rukhsahNone")
                      : t("rhythm.rukhsahValue", { count: rukhsah })
                  }
                />
                <Row
                  label={t("sign.niyyah")}
                  value={niyyah.trim() || t("sign.noNiyyah")}
                  muted={!niyyah.trim()}
                />
              </dl>

              <div className="rounded-2xl border border-gold-500/35 bg-gold-500/[0.07] p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-gold-ink">
                  <ScrollText className="h-4 w-4 shrink-0" />
                  {t("sign.warningTitle")}
                </p>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
                  {t("sign.warningBody")}
                </p>
              </div>

              <button
                type="submit"
                disabled={pending}
                className={buttonStyles({ size: "lg", className: "w-full" })}
              >
                <Check className="h-4 w-4" />
                {pending ? t("sign.confirming") : t("sign.confirm")}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── Navigation ── */}
      <div className="mt-10 flex items-center justify-between gap-3 border-t border-[var(--line-subtle)] pt-6">
        <button
          type="button"
          onClick={() => setStep(STEPS[Math.max(0, index - 1)])}
          disabled={index === 0 || pending}
          className={buttonStyles({ variant: "ghost", className: index === 0 ? "invisible" : "" })}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t("new.back")}
        </button>

        {step !== "sign" && (
          <button
            type="button"
            onClick={() => setStep(STEPS[index + 1])}
            disabled={!canAdvance}
            className={buttonStyles({ className: "group" })}
          >
            {t("new.next")}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Small pieces ──────────────────────────────────────────────────────── */

function ScopeCard({
  selected,
  onSelect,
  title,
  description,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 transition-[border-color,background-color] duration-300",
        selected
          ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]"
          : "border-[var(--line-strong)]",
      )}
    >
      <button type="button" onClick={onSelect} className="flex w-full items-start gap-3 text-start">
        <span
          className={cn(
            "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border",
            selected ? "border-[var(--accent)] bg-[var(--accent-ground)]" : "border-[var(--line-strong)]",
          )}
        >
          {selected && <Check className="h-3 w-3 text-[var(--on-accent)]" strokeWidth={3} />}
        </span>
        <span className="min-w-0">
          <span className="block text-[0.9375rem] font-medium text-[var(--text-strong)]">
            {title}
          </span>
          <span className="mt-0.5 block text-[0.8125rem] text-[var(--text-muted)]">
            {description}
          </span>
        </span>
      </button>
      {selected && children}
    </div>
  );
}

function JuzSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-xl border border-[var(--line-strong)] bg-[var(--surface-inset)]/60 px-3 py-2.5 text-sm text-[var(--text-strong)] tabular-nums focus:border-[var(--accent)] focus:outline-none"
      >
        {Array.from({ length: TOTAL_JUZ }, (_, i) => i + 1).map((juz) => (
          <option key={juz} value={juz}>
            {juz}
          </option>
        ))}
      </select>
    </label>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-xl border border-[var(--line-strong)]">
      <StepButton onClick={() => onChange(value - 1)} disabled={value <= min} sign="−" />
      <input
        type="number"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 border-x border-[var(--line-strong)] bg-transparent py-2.5 text-center text-sm text-[var(--text-strong)] tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <StepButton onClick={() => onChange(value + 1)} disabled={value >= max} sign="+" />
    </div>
  );
}

function StepButton({
  onClick,
  disabled,
  sign,
}: {
  onClick: () => void;
  disabled: boolean;
  sign: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={sign === "+" ? "increase" : "decrease"}
      className="grid h-10 w-10 place-items-center text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)] disabled:opacity-35"
    >
      {sign}
    </button>
  );
}

function Row({
  label,
  value,
  emphasis,
  muted,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-[var(--line-subtle)] px-5 py-3.5 last:border-b-0">
      <dt className="shrink-0 text-[0.8125rem] text-[var(--text-muted)]">{label}</dt>
      <dd
        className={cn(
          "text-end text-[0.9375rem]",
          emphasis
            ? "font-[family-name:var(--font-display)] text-lg text-[var(--accent-strong)]"
            : muted
              ? "text-[var(--text-faint)] italic"
              : "text-[var(--text-strong)]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
