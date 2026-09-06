"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { Field, FormError, FormNotice, PasswordInput } from "@/components/ui/field";
import { OtpInput } from "@/components/ui/otp-input";
import { PasswordStrength } from "@/components/ui/password-strength";
import { buttonStyles } from "@/components/ui/button";
import { IDLE, type FormState } from "@/auth/form-state";
import {
  resetTwoFactorAction,
  sendTwoFactorResetCode,
  verifyTwoFactorAction,
} from "@/app/[locale]/app/settings/two-factor-actions";
import { SubmitButton } from "./submit-button";

/**
 * The second password, asked for after the first one was right.
 *
 * And, on the same screen, the way out of having forgotten it: a code to the
 * inbox that was already proved at sign-up. Kept together rather than on two
 * pages because forgetting is discovered *here*, mid-attempt, and sending
 * somebody away to find the remedy is how a locked-out reader gives up.
 */
export function TwoFactorForm() {
  const t = useTranslations("auth.twoFactor");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("auth.errors");

  const [state, action, pending] = useActionState(verifyTwoFactorAction, IDLE);
  const [reset, resetAction, resetting] = useActionState(resetTwoFactorAction, IDLE);
  const [sent, setSent] = useState<FormState | null>(null);
  const [sending, startSend] = useTransition();
  const [forgot, setForgot] = useState(false);
  const [password, setPassword] = useState("");

  const fieldError = (form: FormState, name: string) => {
    const key = form.fieldErrors?.[name];
    return key ? tv(key) : undefined;
  };

  function requestCode() {
    setForgot(true);
    startSend(async () => setSent(await sendTwoFactorResetCode()));
  }

  if (forgot) {
    return (
      <form action={resetAction} className="space-y-6" noValidate>
        {sent?.status === "success" && <FormNotice>{t("codeSent")}</FormNotice>}
        {sent?.error && <FormError>{te(sent.error.code, sent.error.values)}</FormError>}
        {reset.error && <FormError>{te(reset.error.code, reset.error.values)}</FormError>}

        <div className="space-y-2">
          <p className="text-[0.8125rem] font-medium text-[var(--text-default)]">{t("code")}</p>
          <OtpInput
            name="code"
            label={t("code")}
            autoFocus
            invalid={!!reset.error || !!fieldError(reset, "code")}
            disabled={resetting || sending}
          />
        </div>

        <Field label={t("newPassword")} htmlFor="password" error={fieldError(reset, "password")}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
            onChange={(e) => setPassword(e.target.value)}
            invalid={!!fieldError(reset, "password")}
          />
          <PasswordStrength password={password} className="pt-2" />
        </Field>

        <Field
          label={t("confirmPassword")}
          htmlFor="passwordConfirm"
          error={fieldError(reset, "passwordConfirm")}
        >
          <PasswordInput
            id="passwordConfirm"
            name="passwordConfirm"
            autoComplete="new-password"
            required
            invalid={!!fieldError(reset, "passwordConfirm")}
          />
        </Field>

        <SubmitButton label={t("resetSubmit")} pendingLabel={t("resetting")} pending={resetting} />

        <button
          type="button"
          onClick={() => setForgot(false)}
          className="w-full text-center text-[0.8125rem] text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]"
        >
          {t("backToChallenge")}
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-6" noValidate>
      {state.error && <FormError>{te(state.error.code, state.error.values)}</FormError>}

      <Field label={t("password")} htmlFor="password" error={fieldError(state, "password")}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="off"
          required
          autoFocus
          invalid={!!state.error}
        />
      </Field>

      <SubmitButton label={t("submit")} pendingLabel={t("checking")} pending={pending} />

      <button
        type="button"
        onClick={requestCode}
        disabled={sending}
        className={buttonStyles({
          variant: "outline",
          size: "sm",
          className: "w-full justify-center",
        })}
      >
        {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {t("forgot")}
      </button>
    </form>
  );
}
