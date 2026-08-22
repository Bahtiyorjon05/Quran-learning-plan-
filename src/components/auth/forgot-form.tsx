"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Field, FormError, TextInput } from "@/components/ui/field";
import { forgotAction, IDLE } from "@/app/[locale]/(auth)/actions";
import { SubmitButton } from "./submit-button";

export function ForgotForm() {
  const t = useTranslations("auth.forgot");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("auth.errors");

  const [state, action, pending] = useActionState(forgotAction, IDLE);
  const emailError = state.fieldErrors?.email;

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error && <FormError>{te(state.error.code, state.error.values)}</FormError>}

      <Field
        label={t("email")}
        htmlFor="email"
        error={emailError ? tv(emailError) : undefined}
      >
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
          invalid={!!emailError}
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
