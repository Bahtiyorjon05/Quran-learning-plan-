"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Field, FormError, PasswordInput, TextInput } from "@/components/ui/field";
import { loginAction } from "@/app/[locale]/(auth)/actions";
import { IDLE } from "@/auth/form-state";
import { SubmitButton } from "./submit-button";

export function LoginForm() {
  const t = useTranslations("auth.login");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("auth.errors");

  const [state, action, pending] = useActionState(loginAction, IDLE);

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
          autoFocus
          required
          invalid={!!fieldError("email")}
        />
      </Field>

      <Field
        label={t("password")}
        htmlFor="password"
        error={fieldError("password")}
        trailing={
          <Link
            href="/forgot-password"
            className="text-[0.8125rem] text-[var(--text-muted)] transition-colors hover:text-[var(--accent-strong)]"
          >
            {t("forgot")}
          </Link>
        }
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          invalid={!!fieldError("password")}
        />
      </Field>

      <SubmitButton
        label={t("submit")}
        pendingLabel={t("submitting")}
        pending={pending}
        className="mt-2"
      />
    </form>
  );
}
