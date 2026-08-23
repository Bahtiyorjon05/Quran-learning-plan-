"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { addMonths, differenceInCalendarDays, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Lock, ScrollText, ShieldCheck, X } from "lucide-react";

import { Section, Measure, Eyebrow, SectionTitle, Lead, Panel } from "@/components/ui/section";
import { useMounted } from "@/lib/client-store";
import { cn } from "@/lib/utils";

const TOTAL_LINES = 9060; // 604 pages × 15 lines in the Madani mushaf
const MIN_MONTHS = 6;

type Verdict = { kind: "accepted" | "refused"; at: number } | null;

export function CovenantDemo() {
  const t = useTranslations("landing.covenant");
  const format = useFormatter();

  /* The deadline is computed from today's date, which differs between the
     server render and the browser. Rendering a dash until hydration keeps the
     markup identical; an effect-set flag would render twice to say the same. */
  const mounted = useMounted();
  const [months, setMonths] = useState(36);
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [log, setLog] = useState<{ from: number; to: number }[]>([]);

  const { deadline, days, linesPerDay } = useMemo(() => {
    const today = startOfDay(new Date());
    const target = addMonths(today, months);
    const d = Math.max(1, differenceInCalendarDays(target, today));
    return { deadline: target, days: d, linesPerDay: Math.ceil(TOTAL_LINES / d) };
  }, [months]);

  function pullEarlier() {
    if (months <= MIN_MONTHS) return;
    const next = months - 6;
    setLog((l) => [{ from: months, to: next }, ...l].slice(0, 3));
    setMonths(next);
    setVerdict({ kind: "accepted", at: Date.now() });
  }

  function pushLater() {
    // There is deliberately no state change here. This is the whole point.
    setVerdict({ kind: "refused", at: Date.now() });
  }

  const refused = verdict?.kind === "refused";

  return (
    <Section id="covenant" className="scroll-mt-20">
      <Measure>
        <div className="max-w-3xl">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <SectionTitle>{t("title")}</SectionTitle>
          <Lead>{t("lead")}</Lead>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:items-start">
          {/* ── The covenant card ── */}
          <div
            key={refused && verdict ? verdict.at : undefined}
            className={cn(
              "relative overflow-hidden rounded-2xl border p-6 sm:p-8",
              "bg-[linear-gradient(160deg,var(--surface-raised),var(--surface-base))]",
              refused ? "animate-refuse border-clay-500/40" : "border-[var(--line-strong)]",
            )}
          >
            <div
              aria-hidden
              className="girih pointer-events-none absolute inset-0 opacity-[0.03]"
            />

            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.6875rem] font-semibold tracking-[0.18em] text-[var(--text-faint)] uppercase">
                  {t("planLabel")}
                </p>
                <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-normal text-[var(--text-strong)]">
                  {t("planScope")}
                </p>
              </div>
              <Lock className="mt-1 h-5 w-5 shrink-0 text-gold-ink" strokeWidth={1.5} />
            </div>

            <div className="relative mt-8 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs text-[var(--text-muted)]">{t("finishBy")}</p>
                <p className="mt-1.5 font-[family-name:var(--font-display)] text-3xl leading-none font-light text-[var(--text-strong)] tabular-nums transition-all duration-500 sm:text-[2.25rem]">
                  {mounted ? format.dateTime(deadline, "long") : "—"}
                </p>
              </div>
              <div className="sm:text-end">
                <p className="text-xs text-[var(--text-muted)]">{t("dailyDose")}</p>
                <p className="mt-1.5 font-[family-name:var(--font-display)] text-3xl leading-none font-light text-[var(--accent-strong)] tabular-nums transition-all duration-500 sm:text-[2.25rem]">
                  {mounted ? t("linesPerDay", { count: linesPerDay }) : "—"}
                </p>
              </div>
            </div>

            {/* ── The two directions ── */}
            <div className="relative mt-8 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={pullEarlier}
                disabled={months <= MIN_MONTHS}
                className={cn(
                  "group flex items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/[0.07] px-4 py-3.5",
                  "text-sm font-medium text-[var(--accent-strong)] transition-all duration-300",
                  "hover:border-emerald-400/60 hover:bg-emerald-500/15 active:scale-[0.99]",
                  "disabled:pointer-events-none disabled:opacity-40",
                )}
              >
                <ChevronLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
                {t("pullEarlier")}
              </button>

              <button
                type="button"
                onClick={pushLater}
                className={cn(
                  "group flex items-center justify-center gap-2 rounded-xl border border-[var(--line-strong)] px-4 py-3.5",
                  "text-sm font-medium text-[var(--text-muted)] transition-all duration-300",
                  "hover:border-clay-500/50 hover:bg-clay-500/[0.07] hover:text-danger active:scale-[0.99]",
                )}
              >
                {t("pushLater")}
                <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </button>
            </div>

            {/* ── Verdict ── */}
            <div className="relative mt-4 min-h-[5.5rem]">
              {verdict === null ? (
                <p className="pt-6 text-center text-xs text-[var(--text-faint)]">
                  {t("tryIt")}
                </p>
              ) : (
                <div
                  key={verdict.at}
                  className={cn(
                    "animate-rise flex gap-3 rounded-xl border p-4",
                    refused
                      ? "border-clay-500/35 bg-clay-500/[0.08]"
                      : "border-emerald-500/30 bg-emerald-500/[0.07]",
                  )}
                >
                  {refused ? (
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                  ) : (
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                  )}
                  <div>
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        refused ? "text-danger" : "text-[var(--accent-strong)]",
                      )}
                    >
                      {refused ? t("refusedTitle") : t("acceptedTitle")}
                    </p>
                    <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
                      {refused ? t("refusedBody") : t("acceptedBody")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── The amendment log writes itself ── */}
            {log.length > 0 && (
              <div className="relative mt-5 border-t border-[var(--line-subtle)] pt-4">
                <p className="flex items-center gap-2 text-[0.6875rem] font-semibold tracking-[0.16em] text-[var(--text-faint)] uppercase">
                  <ScrollText className="h-3.5 w-3.5" />
                  plan_amendments
                </p>
                <ul className="mt-3 space-y-1.5 font-mono text-[0.6875rem] text-[var(--text-muted)]">
                  {log.map((entry, i) => (
                    <li key={i} className="animate-rise flex items-center gap-2 tabular-nums">
                      <span className="text-[var(--accent)]">+</span>
                      <span>
                        {entry.from}mo → {entry.to}mo
                      </span>
                      <span className="text-[var(--text-faint)]">· shortened · immutable</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* ── Why it holds ── */}
          <div className="grid gap-4">
            {(["db", "log", "rukhsah"] as const).map((key, i) => {
              const Icon = [Lock, ScrollText, ShieldCheck][i];
              return (
                <Panel key={key} className="hover:border-[var(--line-strong)]">
                  <div className="flex gap-4">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-overlay)]">
                      <Icon className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.6} />
                    </span>
                    <div>
                      <h3 className="text-[0.9375rem] font-semibold text-[var(--text-strong)]">
                        {t(`rules.${key}.title`)}
                      </h3>
                      <p className="mt-1.5 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
                        {t(`rules.${key}.body`)}
                      </p>
                    </div>
                  </div>
                </Panel>
              );
            })}
          </div>
        </div>
      </Measure>
    </Section>
  );
}
