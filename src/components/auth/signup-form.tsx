"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Field, FormError, TextInput } from "@/components/ui/field";
import { IDLE, signupAction } from "@/app/[locale]/(auth)/actions";
import { SubmitButton } from "./submit-button";

/**
 * One field: the address.
 *
 * The password used to be here. Asking someone to invent a strong one before
 * they have even proved they own the inbox front-loads the hardest part of
 * sign-up onto the least committed moment. It is chosen after the code comes
 * back instead.
 *
 * The confirm-address field went too. A mistyped address is already
 * self-correcting — no code arrives, and the next screen offers a way back —
 * whereas the second field quietly refused to submit for anyone who skipped it.
 */
export function SignupForm() {
  const t = useTranslations("auth.signup");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("auth.errors");

  const [state, action, pending] = useActionState(signupAction, IDLE);

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
          autoFocus
          required
          invalid={!!fieldError("email")}
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
