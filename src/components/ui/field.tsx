"use client";

import * as React from "react";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Input ─────────────────────────────────────────────────────────────────
   One visual treatment for every text field in the product. Errors are shown
   with a colour *and* an icon *and* text, never colour alone.               */

export const inputStyles = (invalid?: boolean) =>
  cn(
    "peer w-full rounded-xl border bg-[var(--surface-inset)]/60 px-4 py-3 text-[0.9375rem]",
    "text-[var(--text-strong)] placeholder:text-[var(--text-faint)]",
    "transition-[border-color,box-shadow,background-color] duration-300 ease-[var(--ease-calm)]",
    "focus:outline-none focus:ring-4",
    invalid
      ? "border-clay-500/60 focus:border-clay-400 focus:ring-clay-500/15"
      : "border-[var(--line-strong)] hover:border-[var(--text-faint)] focus:border-[var(--accent)] focus:ring-[color-mix(in_oklab,var(--accent)_18%,transparent)]",
    "disabled:cursor-not-allowed disabled:opacity-50",
  );

export interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  trailing,
  className,
}: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={htmlFor}
          className="text-[0.8125rem] font-medium text-[var(--text-default)]"
        >
          {label}
        </label>
        {trailing}
      </div>

      {children}

      {error ? (
        <p
          id={`${htmlFor}-error`}
          role="alert"
          className="flex items-start gap-1.5 text-[0.8125rem] text-clay-300"
        >
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-[0.8125rem] text-[var(--text-faint)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const TextInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function TextInput({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${props.id}-error` : undefined}
      className={cn(inputStyles(invalid), className)}
      {...props}
    />
  );
});

/* ── Password ──────────────────────────────────────────────────────────────
   A reveal toggle, because forcing someone to retype a long password blind is
   the main reason people pick short ones.                                    */

export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    invalid?: boolean;
    revealLabel?: string;
    hideLabel?: string;
  }
>(function PasswordInput(
  { className, invalid, revealLabel = "Show password", hideLabel = "Hide password", ...props },
  ref,
) {
  const [shown, setShown] = React.useState(false);

  return (
    <div className="relative">
      <input
        ref={ref}
        type={shown ? "text" : "password"}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${props.id}-error` : undefined}
        className={cn(inputStyles(invalid), "pe-12", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? hideLabel : revealLabel}
        aria-pressed={shown}
        tabIndex={-1}
        className={cn(
          "absolute end-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg",
          "text-[var(--text-faint)] transition-colors hover:text-[var(--text-strong)]",
        )}
      >
        {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

/* ── Form-level error ─────────────────────────────────────────────────────── */

export function FormError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="animate-rise flex items-start gap-2.5 rounded-xl border border-clay-500/35 bg-clay-500/[0.08] px-4 py-3 text-[0.875rem] leading-relaxed text-clay-200"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-clay-400" />
      <span>{children}</span>
    </div>
  );
}

export function FormNotice({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="status"
      className="animate-rise rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-4 py-3 text-[0.875rem] leading-relaxed text-emerald-200"
    >
      {children}
    </div>
  );
}
