"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";

import { Field, TextInput } from "@/components/ui/field";
import { RECITERS, DEFAULT_RECITER } from "@/lib/reciters";
import { cn } from "@/lib/utils";
import {
  completeOnboarding,
  ONBOARDING_IDLE,
} from "@/app/[locale]/onboarding/actions";
import { SubmitButton } from "./submit-button";

export function OnboardingForm() {
  const t = useTranslations("onboarding");
  const tv = useTranslations("auth.validation");

  const [state, action, pending] = useActionState(completeOnboarding, ONBOARDING_IDLE);
  const [reciter, setReciter] = useState<string>(DEFAULT_RECITER);
  const [timeZone, setTimeZone] = useState("");

  /* Read from the browser rather than guessed server-side: an IP in Tashkent
     can still belong to someone studying in another country. */
  useEffect(() => {
    try {
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
    } catch {
      setTimeZone("");
    }
  }, []);

  const fieldError = (name: string) => {
    const key = state.fieldErrors?.[name];
    return key ? tv(key) : undefined;
  };

  return (
    <form action={action} className="space-y-7" noValidate>
      <input type="hidden" name="timeZone" value={timeZone} />
      <input type="hidden" name="reciter" value={reciter} />

      <Field
        label={t("studyTime")}
        htmlFor="studyTime"
        error={fieldError("studyTime")}
        hint={t("studyTimeHint")}
      >
        <TextInput
          id="studyTime"
          name="studyTime"
          type="time"
          defaultValue="05:30"
          className="[color-scheme:inherit]"
          invalid={!!fieldError("studyTime")}
        />
      </Field>

      <fieldset>
        <legend className="text-[0.8125rem] font-medium text-[var(--text-default)]">
          {t("reciter")}
        </legend>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {RECITERS.map((option) => {
            const selected = option.id === reciter;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setReciter(option.id)}
                aria-pressed={selected}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-start",
                  "transition-[border-color,background-color] duration-300 ease-[var(--ease-calm)]",
                  selected
                    ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]"
                    : "border-[var(--line-strong)] hover:border-[var(--text-faint)]",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[var(--text-strong)]">
                    {option.name}
                  </span>
                  <span
                    className="font-arabic block truncate text-xs text-[var(--text-faint)]"
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

        <p className="mt-2 text-[0.8125rem] text-[var(--text-faint)]">{t("reciterHint")}</p>
      </fieldset>

      <SubmitButton
        label={t("submit")}
        pendingLabel={t("submitting")}
        pending={pending}
      />
    </form>
  );
}
