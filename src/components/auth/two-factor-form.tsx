"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CircleCheck, Loader2 } from "lucide-react";

import { Field, FormError, FormNotice, PasswordInput } from "@/components/ui/field";
import { OtpInput } from "@/components/ui/otp-input";
import { PasswordStrength } from "@/components/ui/password-strength";
import { buttonStyles } from "@/components/ui/button";
import { IDLE, type FormState } from "@/auth/form-state";
import {
  checkTwoFactorCodeAction,
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
  const [check, checkAction, checking] = useActionState(checkTwoFactorCodeAction, IDLE);
  const [reset, resetAction, resetting] = useActionState(resetTwoFactorAction, IDLE);
  const [sent, setSent] = useState<FormState | null>(null);
  const [sending, startSend] = useTransition();
  const [forgot, setForgot] = useState(false);
  const [password, setPassword] = useState("");
  const codeForm = useRef<HTMLFormElement>(null);

  const fieldError = (form: FormState, name: string) => {
    const key = form.fieldErrors?.[name];
    return key ? tv(key) : undefined;
  };

  function requestCode() {
    setForgot(true);
    startSend(async () => setSent(await sendTwoFactorResetCode()));
  }

  /* The same rule as everywhere else a code and a password share a screen:
     the password fields do not exist until the code has come back right. */
  const codeAccepted = check.status === "success";

  if (forgot) {
    const live = codeAccepted ? reset : check;
    return (
      <form
        ref={codeForm}
        action={codeAccepted ? resetAction : checkAction}
        className="space-y-6"
        noValidate
      >
        {!codeAccepted && sent?.status === "success" && <FormNotice>{t("codeSent")}</FormNotice>}
        {sent?.error && <FormError>{te(sent.error.code, sent.error.values)}</FormError>}
        {live.error && <FormError>{te(live.error.code, live.error.values)}</FormError>}

        <input type="hidden" name="purpose" value="reset" />

        <div className="space-y-2">
          <p className="flex items-center justify-between gap-3 text-[0.8125rem] font-medium text-[var(--text-default)]">
            {t("code")}
            {codeAccepted && (
              <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-normal text-[var(--accent-strong)]">
                <CircleCheck className="h-3.5 w-3.5" />
                {t("codeAccepted")}
              </span>
            )}
          </p>
          <OtpInput
            name="code"
            label={t("code")}
            autoFocus={!codeAccepted}
            invalid={!codeAccepted && (!!check.error || !!fieldError(check, "code"))}
            disabled={resetting || sending || checking}
            readOnly={codeAccepted}
            onComplete={() => {
              if (!codeAccepted) codeForm.current?.requestSubmit();
            }}
          />
        </div>

        {codeAccepted && (
          <>
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

          </>
        )}

        <SubmitButton
          label={codeAccepted ? t("resetSubmit") : t("checkCode")}
          pendingLabel={codeAccepted ? t("resetting") : t("checkingCode")}
          pending={checking || resetting}
        />

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
