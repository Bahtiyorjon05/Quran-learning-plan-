"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Field, FormError, PasswordInput, TextInput } from "@/components/ui/field";
import { PasswordStrength } from "@/components/ui/password-strength";
import { IDLE, signupAction } from "@/app/[locale]/(auth)/actions";
import { SubmitButton } from "./submit-button";

export function SignupForm() {
  const t = useTranslations("auth.signup");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("auth.errors");

  const [state, action, pending] = useActionState(signupAction, IDLE);
  const [password, setPassword] = useState("");

  const fieldError = (name: string) => {
    const key = state.fieldErrors?.[name];
    return key ? tv(key) : undefined;
  };

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error && <FormError>{te(state.error.code, state.error.values)}</FormError>}

      <Field label={t("email")} htmlFor="email" error={fieldError("email")}>
        <TextInput
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t("emailPlaceholder")}
          required
          invalid={!!fieldError("email")}
        />
      </Field>

      <Field
        label={t("emailConfirm")}
        htmlFor="emailConfirm"
        error={fieldError("emailConfirm")}
      >
        <TextInput
          id="emailConfirm"
          name="emailConfirm"
          type="email"
          inputMode="email"
          /* Deliberately off: autofilling the confirmation defeats the entire
             point of asking twice, which is to catch a typo in the first. */
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          onPaste={(e) => e.preventDefault()}
          required
          invalid={!!fieldError("emailConfirm")}
        />
      </Field>

      <Field
        label={t("password")}
        htmlFor="password"
        error={fieldError("password")}
        hint={t("passwordHint")}
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          value={password}
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

      <SubmitButton
        label={t("submit")}
        pendingLabel={t("submitting")}
        pending={pending}
        className="mt-2"
      />

      <p className="text-center text-xs leading-relaxed text-[var(--text-faint)]">
        {t("termsPrefix")}{" "}
        <Link
          href="/terms"
          className="underline decoration-[var(--line-strong)] underline-offset-2 transition-colors hover:text-[var(--text-muted)]"
        >
          {t("terms")}
        </Link>{" "}
        {t("termsAnd")}{" "}
        <Link
          href="/privacy"
          className="underline decoration-[var(--line-strong)] underline-offset-2 transition-colors hover:text-[var(--text-muted)]"
        >
          {t("privacy")}
        </Link>
        .
      </p>
    </form>
  );
}
