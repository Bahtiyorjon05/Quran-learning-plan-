"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { RotateCw } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { FormError, FormNotice } from "@/components/ui/field";
import { OtpInput } from "@/components/ui/otp-input";
import { OTP_RESEND_COOLDOWN_SECONDS, OTP_TTL_MINUTES } from "@/auth/constants";
import { IDLE, resendAction, verifyAction, type FormState } from "@/app/[locale]/(auth)/actions";
import { SubmitButton } from "./submit-button";
import { cn } from "@/lib/utils";

export function VerifyForm({ showDevHint }: { showDevHint: boolean }) {
  const t = useTranslations("auth.verify");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("auth.errors");

  const [state, action, pending] = useActionState(verifyAction, IDLE);
  const [resend, setResend] = useState<FormState | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resending, startResend] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  function requestNewCode() {
    setResend(null);
    startResend(async () => {
      const result = await resendAction();
      setResend(result);
      if (result.status === "success") {
        setCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      } else if (result.error?.code === "resendTooSoon") {
        setCooldown(Number(result.error.values?.seconds ?? OTP_RESEND_COOLDOWN_SECONDS));
      }
    });
  }

  const codeError = state.fieldErrors?.code;
  const invalid = !!codeError || !!state.error;
  const busy = pending || resending;

  return (
    <div className="space-y-6">
      {state.error && <FormError>{te(state.error.code, state.error.values)}</FormError>}
      {codeError && <FormError>{tv(codeError)}</FormError>}
      {resend?.status === "success" && <FormNotice>{t("resent")}</FormNotice>}
      {resend?.error && cooldown === 0 && (
        <FormError>{te(resend.error.code, resend.error.values)}</FormError>
      )}

      <form ref={formRef} action={action} className="space-y-6" noValidate>
        <OtpInput
          name="code"
          label={t("codeLabel")}
          autoFocus
          invalid={invalid}
          disabled={busy}
          /* Six digits in means they are done typing; making them reach for a
             button as well is friction with no purpose. */
          onComplete={() => formRef.current?.requestSubmit()}
        />

        <p className="text-center text-[0.8125rem] text-[var(--text-faint)]">
          {t("expiresIn", { minutes: OTP_TTL_MINUTES })}
        </p>

        <SubmitButton
          label={t("submit")}
          pendingLabel={t("submitting")}
          pending={pending}
        />
      </form>

      <div className="flex flex-col items-center gap-3 border-t border-[var(--line-subtle)] pt-6">
        <button
          type="button"
          onClick={requestNewCode}
          disabled={cooldown > 0 || busy}
          className={cn(
            "inline-flex items-center gap-2 text-sm transition-colors",
            cooldown > 0 || busy
              ? "cursor-not-allowed text-[var(--text-faint)]"
              : "text-[var(--accent-strong)] hover:underline",
          )}
        >
          <RotateCw className={cn("h-3.5 w-3.5", resending && "animate-spin")} />
          {cooldown > 0 ? t("resendIn", { seconds: cooldown }) : t("resend")}
        </button>

        <p className="text-sm text-[var(--text-faint)]">
          {t("wrongEmail")}{" "}
          <Link
            href="/signup"
            className="text-[var(--text-muted)] underline underline-offset-2 transition-colors hover:text-[var(--text-strong)]"
          >
            {t("startOver")}
          </Link>
        </p>
      </div>

      {showDevHint && (
        <p className="rounded-xl border border-gold-500/25 bg-gold-500/[0.06] px-4 py-3 text-center text-[0.8125rem] text-gold-ink-strong/90">
          {t("devHint")}
        </p>
      )}
    </div>
  );
}
