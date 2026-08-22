import * as React from "react";
import { cn } from "@/lib/utils";

/** The page spine. Every section shares one measure so the layout has rhythm. */
export function Measure({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("measure", className)} {...props}>
      {children}
    </div>
  );
}

export function Section({
  className,
  children,
  id,
  reveal = true,
  ...props
}: React.HTMLAttributes<HTMLElement> & { reveal?: boolean }) {
  return (
    <section
      id={id}
      className={cn(
        "relative py-24 sm:py-28 lg:py-36",
        reveal && "reveal",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

/** Small all-caps label that names a section without shouting. */
export function Eyebrow({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "mb-5 flex items-center gap-3 text-[0.6875rem] font-semibold tracking-[0.22em] text-[var(--accent)] uppercase",
        className,
      )}
    >
      <span
        aria-hidden
        className="h-px w-8 bg-[linear-gradient(90deg,transparent,var(--accent))]"
      />
      {children}
    </p>
  );
}

export function SectionTitle({
  className,
  children,
  as: Tag = "h2",
}: {
  className?: string;
  children: React.ReactNode;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <Tag
      className={cn(
        "font-[family-name:var(--font-display)] text-[2.125rem] leading-[1.08] font-light tracking-[-0.015em] sm:text-5xl lg:text-[3.5rem]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function Lead({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "mt-6 max-w-2xl text-[1.0625rem] leading-[1.7] text-[var(--text-muted)] sm:text-lg",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Soft raised panel used for every card on the page. */
export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-raised)]/70 p-6 backdrop-blur-sm",
        "transition-[border-color,transform,box-shadow] duration-500 ease-[var(--ease-calm)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
