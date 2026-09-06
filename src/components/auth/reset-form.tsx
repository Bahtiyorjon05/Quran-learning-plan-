"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CircleCheck, Info, LifeBuoy } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Field, FormError, PasswordInput, TextInput } from "@/components/ui/field";
import { OtpInput } from "@/components/ui/otp-input";
import { PasswordStrength } from "@/components/ui/password-strength";
import { checkResetCodeAction, resetAction } from "@/app/[locale]/(auth)/actions";
import { IDLE } from "@/auth/form-state";
import { SubmitButton } from "./submit-button";

/**
 * The code first, the password afterwards.
 *
 * Both used to be asked for on one screen, which put the hardest task — invent
 * a password you have never used and will have to remember — in front of
 * somebody who did not yet know whether the six digits they had copied out of
 * an email were even right. Get the code wrong and the password went with it.
 *
 * So it is two steps. The code is checked on its own and costs an attempt
 * exactly as it would have at the end, so nothing is loosened by splitting it;
 * what changes is that the second screen is only ever reached by someone who
 * has already proved they can read the inbox.
 *
 * Which step is showing is derived from the check's result rather than kept in
 * state of its own. There is nothing to fall out of step with that way, and no
 * effect reaching back to set state after a render.
 */
export function ResetForm({ email }: { email: string | null }) {
  const t = useTranslations("auth.reset");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("auth.errors");

  const [check, checkCode, checking] = useActionState(checkResetCodeAction, IDLE);
  const [state, action, pending] = useActionState(resetAction, IDLE);

  const verified = check.status === "success";

  /* Uncontrolled, for the same reason as the set-password form: hydration
     resets a controlled field, taking anything typed before the JavaScript
     arrived with it. */
  const passwordRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");

  useEffect(() => {
    const typedBeforeHydration = passwordRef.current?.value;
    if (typedBeforeHydration) setPassword(typedBeforeHydration);
  }, []);

  const live = verified ? state : check;
  const busy = verified ? pending : checking;
  const fieldError = (name: string) => {
    const key = live.fieldErrors?.[name];
    return key ? tv(key) : undefined;
  };

  /* Out of guesses on this code. A new one can still be asked for, and that is
     the way out — so it is offered here rather than left to be guessed at. */
  const spent = live.error?.code === "codeAttemptsExceeded";

  const address = email ? (
    <input type="hidden" name="email" value={email} />
  ) : (
    /* The address normally arrives in an httpOnly cookie from the previous
       step. It is only asked for when that cookie is gone — a new browser, a
       cleared jar, or a link opened somewhere else. */
    <Field label={t("email")} htmlFor="email" error={fieldError("email")}>
      <TextInput
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        invalid={!!fieldError("email")}
      />
    </Field>
  );

  if (spent) {
    return (
      <div className="space-y-5">
        <FormError>{te("codeAttemptsExceeded")}</FormError>
        <p className="flex items-start gap-2.5 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
          <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-faint)]" />
          {t("spentHelp")}
        </p>
        <Link
          href="/forgot-password"
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--accent-ground)] text-[0.9375rem] font-medium text-[var(--on-accent)] transition-[background-color] duration-300 hover:bg-[var(--accent-strong)]"
        >
          {t("newCode")}
        </Link>
      </div>
    );
  }

  return (
    <form action={verified ? action : checkCode} className="space-y-6" noValidate>
      {live.error && <FormError>{te(live.error.code, live.error.values)}</FormError>}

      {address}

      <div className="space-y-2">
        <p className="flex items-center justify-between gap-3 text-[0.8125rem] font-medium text-[var(--text-default)]">
          {t("code")}
          {verified && (
            <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-normal text-[var(--accent-strong)]">
              <CircleCheck className="h-3.5 w-3.5" />
              {t("codeAccepted")}
            </span>
          )}
        </p>
        <OtpInput
          name="code"
          label={t("code")}
          autoFocus={!!email && !verified}
          invalid={!!fieldError("code") || (!verified && !!live.error)}
          disabled={busy}
          readOnly={verified}
        />
        {fieldError("code") && (
          <p role="alert" className="text-[0.8125rem] text-danger">
            {fieldError("code")}
          </p>
        )}
      </div>

      {verified && (
        <>
          <Field label={t("password")} htmlFor="password" error={fieldError("password")}>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              required
              autoFocus
              ref={passwordRef}
              onChange={(e) => setPassword(e.target.value)}
              invalid={!!fieldError("password")}
            />
            <PasswordStrength password={password} className="pt-2" />
          </Field>

          <Field
            label={t("passwordConfirm")}
            htmlFor="passwordConfirm"
            error={fieldError("passwordConfirm")}
          >
            <PasswordInput
              id="passwordConfirm"
              name="passwordConfirm"
              autoComplete="new-password"
              required
              invalid={!!fieldError("passwordConfirm")}
            />
          </Field>

          <p className="flex items-start gap-2 text-[0.8125rem] leading-relaxed text-[var(--text-faint)]">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t("note")}
          </p>
        </>
      )}

      <SubmitButton
        label={verified ? t("submit") : t("checkCode")}
        pendingLabel={verified ? t("submitting") : t("checking")}
        pending={busy}
      />
    </form>
  );
}
