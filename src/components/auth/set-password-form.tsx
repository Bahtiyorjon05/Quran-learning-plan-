"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck } from "lucide-react";

import { Field, FormError, PasswordInput, TextInput } from "@/components/ui/field";
import { PasswordStrength } from "@/components/ui/password-strength";
import { IDLE } from "@/auth/form-state";
import { setPasswordAction } from "@/app/[locale]/set-password/actions";
import { SubmitButton } from "./submit-button";

export function SetPasswordForm({ email }: { email: string }) {
  const t = useTranslations("auth.setPassword");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("auth.errors");

  const [state, action, pending] = useActionState(setPasswordAction, IDLE);
  const [password, setPassword] = useState("");

  const fieldError = (name: string) => {
    const key = state.fieldErrors?.[name];
    return key ? tv(key) : undefined;
  };

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error && <FormError>{te(state.error.code, state.error.values)}</FormError>}

      {/* The address they just proved, shown back to them so the step feels
          like a continuation rather than a fresh form out of nowhere. */}
      <p className="flex items-center gap-2 rounded-xl border border-[var(--accent)]/25 bg-[color-mix(in_oklab,var(--accent)_8%,transparent)] px-4 py-3 text-[0.875rem]">
        <BadgeCheck className="h-4 w-4 shrink-0 text-[var(--accent)]" />
        <span className="min-w-0 truncate text-[var(--text-default)]">{email}</span>
      </p>

      <Field
        label={t("name")}
        htmlFor="displayName"
        error={fieldError("displayName")}
        hint={t("nameHint")}
      >
        <TextInput
          id="displayName"
          name="displayName"
          autoComplete="name"
          placeholder={t("namePlaceholder")}
          autoFocus
          required
          maxLength={60}
          invalid={!!fieldError("displayName")}
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
    </form>
  );
}
