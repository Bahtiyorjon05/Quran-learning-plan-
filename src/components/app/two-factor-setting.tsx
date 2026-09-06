"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CircleCheck, KeyRound, Loader2, ShieldCheck, ShieldOff } from "lucide-react";

import { Field, FormError, FormNotice, PasswordInput } from "@/components/ui/field";
import { OtpInput } from "@/components/ui/otp-input";
import { PasswordStrength } from "@/components/ui/password-strength";
import { buttonStyles } from "@/components/ui/button";
import { IDLE, type FormState } from "@/auth/form-state";
import {
  checkTwoFactorCodeAction,
  disableTwoFactorAction,
  enableTwoFactorAction,
  sendTwoFactorSetupCode,
} from "@/app/[locale]/app/settings/two-factor-actions";
import { cn } from "@/lib/utils";

/**
 * Turning the second password on, and off.
 *
 * Three states rather than a switch, because the middle one is a real place: a
 * code has gone to the inbox and is waiting to be typed. A toggle that flipped
 * straight to "on" would be lying — nothing is on until the code comes back.
 *
 * Off is deliberately harder than on. It is the one action here that lowers
 * the account's defences, so it asks for the account password again; the
 * session being open is not proof that the account holder is the one closing
 * it.
 */
export function TwoFactorSetting({ enabled }: { enabled: boolean }) {
  const t = useTranslations("settings.twoFactor");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("auth.errors");

  const [sent, setSent] = useState<FormState | null>(null);
  const [sending, startSend] = useTransition();
  const [check, checkAction, checking] = useActionState(checkTwoFactorCodeAction, IDLE);
  const [enable, enableAction, enabling] = useActionState(enableTwoFactorAction, IDLE);
  const [disable, disableAction, disabling] = useActionState(disableTwoFactorAction, IDLE);
  const [password, setPassword] = useState("");
  const [closing, setClosing] = useState(false);
  /* The code form submits itself the moment six digits are in. Nobody types a
     code and then hunts for a button; the button stays for the keyboard and
     for anyone whose paste did not fire an input event. */
  const codeForm = useRef<HTMLFormElement>(null);
  const justEnabled = enable.status === "success";

  /* Derived, not stored: the moment the server says it is on, it is on. */
  const on = enabled ? disable.status !== "success" : enable.status === "success";
  const awaitingCode = !on && sent?.status === "success" && enable.status !== "success";
  /* Derived from the check, so there is no separate step to fall out of sync.
     Until the six digits come back right there is no password field at all —
     inventing one and then losing it to a wrong code is the whole complaint
     this answers. */
  const codeAccepted = check.status === "success";

  const fieldError = (form: FormState, name: string) => {
    const key = form.fieldErrors?.[name];
    return key ? tv(key) : undefined;
  };

  function requestCode() {
    startSend(async () => setSent(await sendTwoFactorSetupCode()));
  }

  return (
    <div className="space-y-4">
      {justEnabled && (
        <FormNotice>
          <span className="flex items-center gap-2">
            <CircleCheck className="h-4 w-4 shrink-0" />
            {t("enabledDone")}
          </span>
        </FormNotice>
      )}

      <div className="flex items-start gap-3.5">
        <span
          className={cn(
            "mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border",
            on
              ? "border-[var(--accent)]/40 bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-[var(--accent-strong)]"
              : "border-[var(--line-subtle)] text-[var(--text-faint)]",
          )}
        >
          {on ? <ShieldCheck className="h-5 w-5" /> : <ShieldOff className="h-5 w-5" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-medium text-[var(--text-strong)]">
            {on ? t("on") : t("off")}
          </p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
            {on ? t("onBody") : t("offBody")}
          </p>
        </div>
      </div>

      {/* ── Off, and being switched on ── */}
      {!on && !awaitingCode && (
        <>
          {sent?.error && <FormError>{te(sent.error.code, sent.error.values)}</FormError>}
          <button
            type="button"
            onClick={requestCode}
            disabled={sending}
            className={buttonStyles({ size: "sm" })}
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
            {sending ? t("sending") : t("turnOn")}
          </button>
        </>
      )}

      {awaitingCode && (
        <form
          ref={codeForm}
          action={codeAccepted ? enableAction : checkAction}
          className="space-y-5 border-t border-[var(--line-subtle)] pt-5"
        >
          {!codeAccepted && <FormNotice>{t("codeSent")}</FormNotice>}
          {(codeAccepted ? enable.error : check.error) && (
            <FormError>
              {te(
                (codeAccepted ? enable.error : check.error)!.code,
                (codeAccepted ? enable.error : check.error)!.values,
              )}
            </FormError>
          )}

          <input type="hidden" name="purpose" value="enable" />

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
              disabled={checking || enabling || codeAccepted}
              onComplete={() => {
                if (!codeAccepted) codeForm.current?.requestSubmit();
              }}
            />
          </div>

          {codeAccepted && (
            <>
          <Field label={t("newPassword")} htmlFor="tfa-password" error={fieldError(enable, "password")}>
            <PasswordInput
              id="tfa-password"
              name="password"
              autoComplete="new-password"
              required
              onChange={(e) => setPassword(e.target.value)}
              invalid={!!fieldError(enable, "password")}
            />
            <PasswordStrength password={password} className="pt-2" />
          </Field>

          <Field
            label={t("confirmPassword")}
            htmlFor="tfa-confirm"
            error={fieldError(enable, "passwordConfirm")}
          >
            <PasswordInput
              id="tfa-confirm"
              name="passwordConfirm"
              autoComplete="new-password"
              required
              invalid={!!fieldError(enable, "passwordConfirm")}
            />
          </Field>

          <p className="text-[0.75rem] leading-relaxed text-[var(--text-faint)]">{t("differentNote")}</p>
            </>
          )}

          <button
            type="submit"
            disabled={checking || enabling}
            className={buttonStyles({ size: "sm" })}
          >
            {checking || enabling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {codeAccepted
              ? enabling
                ? t("turningOn")
                : t("confirm")
              : checking
                ? t("checkingCode")
                : t("checkCode")}
          </button>
        </form>
      )}

      {/* ── On, and being switched off ── */}
      {on && !closing && (
        <button
          type="button"
          onClick={() => setClosing(true)}
          className={buttonStyles({ variant: "outline", size: "sm" })}
        >
          <ShieldOff className="h-3.5 w-3.5" />
          {t("turnOff")}
        </button>
      )}

      {on && closing && (
        <form action={disableAction} className="space-y-4 border-t border-[var(--line-subtle)] pt-5">
          {disable.error && <FormError>{te(disable.error.code, disable.error.values)}</FormError>}

          <Field
            label={t("confirmWithPassword")}
            htmlFor="tfa-account-password"
            error={fieldError(disable, "password")}
          >
            <PasswordInput
              id="tfa-account-password"
              name="password"
              autoComplete="current-password"
              required
              autoFocus
              invalid={!!disable.error}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={disabling}
              className={buttonStyles({ size: "sm", className: "!bg-danger hover:!bg-danger" })}
            >
              {disabling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {disabling ? t("turningOff") : t("turnOff")}
            </button>
            <button
              type="button"
              onClick={() => setClosing(false)}
              className={buttonStyles({ variant: "outline", size: "sm" })}
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
