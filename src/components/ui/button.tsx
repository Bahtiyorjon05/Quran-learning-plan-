import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "gold" | "outline" | "ghost" | "quiet";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex items-center justify-center gap-2 rounded-full font-medium " +
  "whitespace-nowrap select-none transition-[transform,background-color,border-color,color,box-shadow] " +
  "duration-300 ease-[var(--ease-calm)] active:scale-[0.985] " +
  "disabled:pointer-events-none disabled:opacity-45 " +
  "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--accent)]";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--accent-ground)] text-[var(--on-accent)] shadow-[0_1px_0_0_rgba(255,255,255,0.14)_inset,0_10px_30px_-12px_var(--halo)] " +
    "hover:bg-[var(--accent-strong)] hover:shadow-[0_1px_0_0_rgba(255,255,255,0.2)_inset,0_16px_40px_-14px_var(--halo)]",
  gold:
    "bg-gold-400 text-ink-950 shadow-[0_1px_0_0_rgba(255,255,255,0.28)_inset,0_10px_30px_-14px_rgba(201,162,39,0.6)] " +
    "hover:bg-gold-300",
  outline:
    "border border-[var(--line-strong)] text-[var(--text-strong)] bg-transparent " +
    "hover:border-[var(--accent)] hover:text-[var(--accent-strong)] hover:bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]",
  ghost:
    "text-[var(--text-default)] hover:text-[var(--text-strong)] hover:bg-[color-mix(in_oklab,var(--text-strong)_7%,transparent)]",
  quiet:
    "text-[var(--text-muted)] hover:text-[var(--text-strong)]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-13 px-7 text-base",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={buttonStyles({ variant, size, className })}
        {...props}
      />
    );
  },
);
