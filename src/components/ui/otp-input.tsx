"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A six-cell code field that is really one input.
 *
 * Six separate inputs are the common approach and the wrong one: they break
 * paste, they fight screen readers, and — most importantly — iOS and Android
 * will not autofill a code from the Messages/Mail notification into them. A
 * single transparent input with `autocomplete="one-time-code"` gets all three
 * for free; the cells below it are presentation only.
 */
export function OtpInput({
  name,
  length = 6,
  label,
  autoFocus,
  invalid,
  disabled,
  onComplete,
  className,
}: {
  name: string;
  length?: number;
  label: string;
  autoFocus?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  onComplete?: (value: string) => void;
  className?: string;
}) {
  const [value, setValue] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  /* Which code was already handed to the parent, so the same one is not
     submitted twice and a different one always is. */
  const [submitted, setSubmitted] = React.useState("");
  const [wasInvalid, setWasInvalid] = React.useState(invalid);
  const ref = React.useRef<HTMLInputElement>(null);

  /* The parent has just reported a rejection: empty the field so the next code
     can simply be typed. Adjusting state during render rather than in an effect
     is what React asks for when state has to follow a prop — an effect would
     paint the wrong digits first and clear them a frame later. */
  if (invalid !== wasInvalid) {
    setWasInvalid(invalid);
    if (invalid) {
      setValue("");
      setSubmitted("");
    }
  }

  /* And put the caret back, so nothing has to be clicked before retyping. */
  React.useEffect(() => {
    if (invalid && !disabled) ref.current?.focus();
  }, [invalid, disabled]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "").slice(0, length);
    setValue(digits);

    if (digits.length === length && digits !== submitted) {
      setSubmitted(digits);
      onComplete?.(digits);
    }
  }

  const cells = Array.from({ length }, (_, i) => i);
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <div className={cn("relative", className)}>
      <input
        ref={ref}
        id={name}
        name={name}
        value={value}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        disabled={disabled}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={length}
        aria-label={label}
        aria-invalid={invalid || undefined}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer text-transparent caret-transparent opacity-0"
      />

      <div className="flex justify-between gap-2 sm:gap-3" aria-hidden>
        {cells.map((i) => {
          const char = value[i];
          const isActive = focused && !disabled && i === activeIndex && value.length < length;
          const isLastFilled = focused && !disabled && value.length === length && i === length - 1;

          return (
            <div
              key={i}
              className={cn(
                "relative flex h-14 flex-1 items-center justify-center rounded-xl border sm:h-16",
                "font-[family-name:var(--font-display)] text-2xl font-medium tabular-nums sm:text-3xl",
                "transition-[border-color,box-shadow,background-color,transform] duration-200 ease-[var(--ease-calm)]",
                invalid
                  ? "border-clay-500/60 bg-clay-500/[0.06] text-danger"
                  : char
                    ? "border-[var(--accent)]/60 bg-[color-mix(in_oklab,var(--accent)_9%,transparent)] text-[var(--text-strong)]"
                    : "border-[var(--line-strong)] bg-[var(--surface-inset)]/60 text-[var(--text-strong)]",
                (isActive || isLastFilled) &&
                  "scale-[1.03] border-[var(--accent)] ring-4 ring-[color-mix(in_oklab,var(--accent)_18%,transparent)]",
                disabled && "opacity-50",
              )}
            >
              {char ?? ""}
              {isActive && !char && (
                <span className="absolute h-6 w-px animate-pulse bg-[var(--accent)]" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
