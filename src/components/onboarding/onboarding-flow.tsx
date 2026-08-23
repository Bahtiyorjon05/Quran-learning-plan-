"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Moon,
  Pencil,
  Sun,
  Sunrise,
  Sunset,
} from "lucide-react";

import { RECITERS, DEFAULT_RECITER } from "@/lib/reciters";
import { ONBOARDING_IDLE } from "@/auth/form-state";
import { completeOnboarding } from "@/app/[locale]/onboarding/actions";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The study-time question, asked the way the answer is actually thought about.
 *
 * A bare <input type="time"> makes someone convert a habit into digits before
 * they can answer. Almost nobody memorizes "at 05:30" — they memorize after
 * Fajr, or after Isha once the day is finished. These are approximations of
 * those moments, said to be approximate in the caption, with an exact time
 * still there for anyone who wants one.
 */
const MOMENTS = [
  { id: "afterFajr", time: "05:30", Icon: Sunrise },
  { id: "morning", time: "08:00", Icon: Sun },
  { id: "afternoon", time: "14:00", Icon: Sun },
  { id: "afterAsr", time: "17:00", Icon: Sunset },
  { id: "afterIsha", time: "20:30", Icon: Moon },
] as const;

export function OnboardingFlow() {
  const t = useTranslations("onboarding");

  const [state, action, pending] = useActionState(completeOnboarding, ONBOARDING_IDLE);

  const [step, setStep] = useState<0 | 1>(0);
  const [moment, setMoment] = useState<string>("afterFajr");
  const [customTime, setCustomTime] = useState("06:00");
  const [reciter, setReciter] = useState<string>(DEFAULT_RECITER);
  const [timeZone, setTimeZone] = useState("");

  /* Read from the browser rather than guessed server-side: an address in
     Tashkent can still belong to someone studying in another country. */
  useEffect(() => {
    try {
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
    } catch {
      setTimeZone("");
    }
  }, []);

  const studyTime =
    moment === "custom" ? customTime : MOMENTS.find((m) => m.id === moment)!.time;

  return (
    <form action={action} className="flex min-h-0 flex-1 flex-col">
      <input type="hidden" name="timeZone" value={timeZone} />
      <input type="hidden" name="reciter" value={reciter} />
      <input type="hidden" name="studyTime" value={studyTime} />

      <div className="flex items-center gap-3">
        {[0, 1].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-500",
              i <= step ? "bg-[var(--accent)]" : "bg-[var(--line-strong)]",
            )}
          />
        ))}
        <span className="shrink-0 text-[0.6875rem] text-[var(--text-faint)] tabular-nums">
          {t("step", { current: step + 1, total: 2 })}
        </span>
      </div>

      <div key={step} className="animate-rise mt-10 flex-1">
        {step === 0 ? (
          <>
            <h2 className="font-[family-name:var(--font-display)] text-[1.75rem] leading-tight font-light text-[var(--text-strong)] sm:text-[2.125rem]">
              {t("when.title")}
            </h2>
            <p className="mt-3 max-w-lg text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
              {t("when.subtitle")}
            </p>

            <div className="mt-7 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {MOMENTS.map(({ id, time, Icon }) => (
                <MomentCard
                  key={id}
                  selected={moment === id}
                  onSelect={() => setMoment(id)}
                  Icon={Icon}
                  title={t(`when.${id}`)}
                  why={t(`when.${id}Why`)}
                  time={time}
                />
              ))}

              <MomentCard
                selected={moment === "custom"}
                onSelect={() => setMoment("custom")}
                Icon={Pencil}
                title={t("when.custom")}
                why={t("when.customWhy")}
                time={moment === "custom" ? customTime : undefined}
              >
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  aria-label={t("when.custom")}
                  className="mt-3 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface-inset)]/60 px-3 py-2 text-sm text-[var(--text-strong)] tabular-nums focus:border-[var(--accent)] focus:outline-none"
                />
              </MomentCard>
            </div>

            <p className="mt-5 flex items-center gap-2 text-[0.8125rem] text-[var(--text-faint)]">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {t("when.approximate")}
            </p>
          </>
        ) : (
          <>
            <h2 className="font-[family-name:var(--font-display)] text-[1.75rem] leading-tight font-light text-[var(--text-strong)] sm:text-[2.125rem]">
              {t("reciter.title")}
            </h2>
            <p className="mt-3 max-w-lg text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
              {t("reciter.subtitle")}
            </p>

            <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
              {RECITERS.map((option) => {
                const selected = option.id === reciter;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setReciter(option.id)}
                    aria-pressed={selected}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-start",
                      "transition-[border-color,background-color] duration-300 ease-[var(--ease-calm)]",
                      selected
                        ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]"
                        : "border-[var(--line-strong)] hover:border-[var(--text-faint)]",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[0.9375rem] font-medium text-[var(--text-strong)]">
                        {option.name}
                      </span>
                      <span
                        className="font-arabic mt-0.5 block truncate text-sm text-gold-ink"
                        dir="rtl"
                        aria-hidden
                      >
                        {option.arabic}
                      </span>
                    </span>
                    {selected && (
                      <Check className="h-4 w-4 shrink-0 text-[var(--accent)]" strokeWidth={2.5} />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="mt-10 flex items-center justify-between gap-3 border-t border-[var(--line-subtle)] pt-6">
        <button
          type="button"
          onClick={() => setStep(0)}
          className={buttonStyles({
            variant: "ghost",
            className: step === 0 ? "invisible" : "",
          })}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t("back")}
        </button>

        {step === 0 ? (
          <button
            type="button"
            onClick={() => setStep(1)}
            className={buttonStyles({ size: "lg", className: "group" })}
          >
            {t("next")}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180" />
          </button>
        ) : (
          <button type="submit" disabled={pending} className={buttonStyles({ size: "lg" })}>
            <Check className="h-4 w-4" />
            {pending ? t("submitting") : t("submit")}
          </button>
        )}
      </div>

      {state.status === "error" && (
        <p role="alert" className="mt-4 text-center text-sm text-danger">
          {Object.values(state.fieldErrors ?? {})[0] ?? ""}
        </p>
      )}
    </form>
  );
}

function MomentCard({
  selected,
  onSelect,
  Icon,
  title,
  why,
  time,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  why: string;
  time?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-[border-color,background-color] duration-300 ease-[var(--ease-calm)]",
        selected
          ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_9%,transparent)]"
          : "border-[var(--line-strong)] hover:border-[var(--text-faint)]",
      )}
    >
      <button type="button" onClick={onSelect} className="w-full text-start">
        <span className="flex items-start justify-between gap-2">
          <Icon
            className={cn(
              "h-4.5 w-4.5 shrink-0",
              selected ? "text-[var(--accent)]" : "text-[var(--text-faint)]",
            )}
            strokeWidth={1.6}
          />
          {time && (
            <span className="shrink-0 text-[0.6875rem] text-[var(--text-faint)] tabular-nums">
              {time}
            </span>
          )}
        </span>
        <span className="mt-3 block text-[0.9375rem] font-medium text-[var(--text-strong)]">
          {title}
        </span>
        <span className="mt-1 block text-[0.75rem] leading-relaxed text-[var(--text-muted)]">
          {why}
        </span>
      </button>
      {selected && children}
    </div>
  );
}
