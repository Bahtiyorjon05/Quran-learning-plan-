"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Field, FormError, TextInput } from "@/components/ui/field";
import { IDLE, signupAction } from "@/app/[locale]/(auth)/actions";
import { SubmitButton } from "./submit-button";

/**
 * An address, twice, and nothing more.
 *
 * The password used to be here. Asking someone to invent a strong one before
 * they have even proved they own the inbox front-loads the hardest part of
 * sign-up onto the least committed moment — and a typo in the address means the
 * code never arrives and the password was wasted effort. It is chosen after the
 * code comes back instead.
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
          /* Autofill and paste are both off: filling the confirmation from the
             first field defeats the only thing it is for, which is catching a
             typo before the code is sent somewhere unreachable. */
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          onPaste={(e) => e.preventDefault()}
          required
          invalid={!!fieldError("emailConfirm")}
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
