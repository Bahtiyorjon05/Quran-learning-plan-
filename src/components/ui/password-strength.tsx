"use client";

import { useTranslations } from "next-intl";
import { scorePassword } from "@/auth/password-policy";
import { cn } from "@/lib/utils";

const BAR = [
  "bg-clay-500",
  "bg-clay-400",
  "bg-gold-500",
  "bg-emerald-500",
  "bg-emerald-400",
] as const;

const TEXT = [
  "text-clay-300",
  "text-clay-300",
  "text-gold-300",
  "text-emerald-300",
  "text-emerald-300",
] as const;

/**
 * A guide, not a gate — the server decides what is acceptable. Four segments
 * rather than a percentage, because a smooth bar invites people to game the
 * number instead of lengthening the password.
 */
export function PasswordStrength({
  password,
  className,
}: {
  password: string;
  className?: string;
}) {
  const t = useTranslations("auth.signup");
  const score = scorePassword(password);
  const shown = password.length > 0;

  return (
    <div
      className={cn(
        "transition-opacity duration-300",
        shown ? "opacity-100" : "opacity-0",
        className,
      )}
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-all duration-500 ease-[var(--ease-calm)]",
                shown && i < score
                  ? BAR[score]
                  : "bg-[color-mix(in_oklab,var(--text-strong)_10%,transparent)]",
              )}
            />
          ))}
        </div>
        <span
          className={cn(
            "w-20 shrink-0 text-end text-[0.75rem] font-medium tabular-nums",
            shown ? TEXT[score] : "text-transparent",
          )}
        >
          {shown ? t(`strength${score}` as "strength0") : "—"}
        </span>
      </div>
      <span className="sr-only">
        {t("strengthLabel")}: {t(`strength${score}` as "strength0")}
      </span>
    </div>
  );
}
