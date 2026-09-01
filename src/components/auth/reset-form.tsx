"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";

import { Field, FormError, PasswordInput, TextInput } from "@/components/ui/field";
import { OtpInput } from "@/components/ui/otp-input";
import { PasswordStrength } from "@/components/ui/password-strength";
import { resetAction } from "@/app/[locale]/(auth)/actions";
import { IDLE } from "@/auth/form-state";
import { SubmitButton } from "./submit-button";

export function ResetForm({ email }: { email: string | null }) {
  const t = useTranslations("auth.reset");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("auth.errors");

  const [state, action, pending] = useActionState(resetAction, IDLE);

  /* Uncontrolled, for the same reason as the set-password form: hydration
     resets a controlled field, taking anything typed before the JavaScript
     arrived with it. */
  const passwordRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");

  useEffect(() => {
    const typedBeforeHydration = passwordRef.current?.value;
    if (typedBeforeHydration) setPassword(typedBeforeHydration);
  }, []);

  const fieldError = (name: string) => {
    const key = state.fieldErrors?.[name];
    return key ? tv(key) : undefined;
  };

  return (
    <form action={action} className="space-y-6" noValidate>
      {state.error && <FormError>{te(state.error.code, state.error.values)}</FormError>}

      {/* The address normally arrives in an httpOnly cookie from the previous
          step. It is only asked for when that cookie is gone — a new browser,
          a cleared jar, or a link opened somewhere else. */}
      {email ? (
        <input type="hidden" name="email" value={email} />
      ) : (
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
      )}

      <div className="space-y-2">
        <p className="text-[0.8125rem] font-medium text-[var(--text-default)]">
          {t("code")}
        </p>
        <OtpInput
          name="code"
          label={t("code")}
          autoFocus={!!email}
          invalid={!!fieldError("code")}
          disabled={pending}
        />
        {fieldError("code") && (
          <p role="alert" className="text-[0.8125rem] text-danger">
            {fieldError("code")}
          </p>
        )}
      </div>

      <Field
        label={t("password")}
        htmlFor="password"
        error={fieldError("password")}
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
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

      <SubmitButton
        label={t("submit")}
        pendingLabel={t("submitting")}
        pending={pending}
      />
    </form>
  );
}
