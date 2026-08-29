import { LayoutDashboard, ShieldCheck, Users } from "lucide-react";

import { Wordmark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { Measure } from "@/components/ui/section";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The frame around the admin screens.
 *
 * Marked, unmistakably, as a different place from the product. Anyone who can
 * open these pages can read other people's addresses and progress, and a screen
 * with that power should never be mistaken at a glance for the one everybody
 * else sees — hence the band across the top and the shield in the wordmark.
 *
 * No language switcher: these pages are for whoever runs Ahd, they are written
 * in English only, and translating an internal tool into three languages is
 * work that buys nothing.
 */
export async function AdminShell({
  children,
  current,
}: {
  children: React.ReactNode;
  current: "overview" | "users";
}) {
  const tabs = [
    { id: "overview", href: "/admin", icon: LayoutDashboard, label: "Overview" },
    { id: "users", href: "/admin/users", icon: Users, label: "People" },
  ] as const;

  return (
    <div className="min-h-dvh">
      {/* The band. Small, permanent, and the only thing on the site with this
          colour, so it never reads as decoration. */}
      <div className="bg-[var(--status-warning)]/12 border-b border-[var(--status-warning)]/25">
        <Measure className="flex h-8 items-center gap-2 text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--status-warning-ink)] uppercase">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          Admin — you are seeing everyone&rsquo;s data
        </Measure>
      </div>

      <header className="sticky top-0 z-40 border-b border-[var(--line-subtle)] bg-[color-mix(in_oklab,var(--surface-base)_88%,transparent)] backdrop-blur-xl">
        <Measure className="flex h-16 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-5">
            <Link href="/admin" aria-label="Ahd admin" className="shrink-0">
              <Wordmark priority size={30} />
            </Link>

            <nav className="flex items-center gap-1" aria-label="Admin">
              {tabs.map((tab) => (
                <Link
                  key={tab.id}
                  href={tab.href}
                  aria-current={tab.id === current ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm",
                    "transition-[color,background-color] duration-300 ease-[var(--ease-calm)]",
                    tab.id === current
                      ? "bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] font-medium text-[var(--accent-strong)]"
                      : "text-[var(--text-muted)] hover:bg-[color-mix(in_oklab,var(--text-strong)_6%,transparent)] hover:text-[var(--text-strong)]",
                  )}
                >
                  <tab.icon className="h-4 w-4" strokeWidth={tab.id === current ? 2 : 1.7} />
                  {tab.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Link
              href="/app"
              className={buttonStyles({ variant: "outline", size: "sm" })}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span className="max-sm:hidden">Back to the app</span>
            </Link>
          </div>
        </Measure>
      </header>

      <main>{children}</main>
    </div>
  );
}

/**
 * A panel: a heading, an optional note, and something inside.
 *
 * The note is where the caveat goes — "of active covenants", "since launch" —
 * because a number without its denominator is the most common way a dashboard
 * misleads the person reading it.
 */
export function Panel({
  title,
  note,
  children,
  className,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-raised)]/40 p-5 sm:p-6",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[0.9375rem] font-medium text-[var(--text-strong)]">{title}</h2>
        {note && (
          <span className="shrink-0 text-[0.6875rem] text-[var(--text-faint)]">{note}</span>
        )}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/**
 * A number that needs no chart.
 *
 * Most of what an admin wants is a single figure. A bar chart of one value is
 * decoration; the number itself, large, with a word under it, is the whole
 * answer.
 */
export function Metric({
  value,
  label,
  hint,
  tone = "plain",
}: {
  value: string | number;
  label: string;
  hint?: string;
  tone?: "plain" | "good" | "warn";
}) {
  return (
    <div className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-raised)]/40 px-5 py-4">
      <p
        className={cn(
          "font-[family-name:var(--font-display)] text-[2rem] leading-none font-light tabular-nums",
          tone === "plain" && "text-[var(--text-strong)]",
          tone === "good" && "text-[var(--status-good-ink)]",
          tone === "warn" && "text-[var(--status-warning-ink)]",
        )}
      >
        {value}
      </p>
      <p className="mt-2 text-[0.75rem] leading-tight text-[var(--text-muted)]">{label}</p>
      {hint && <p className="mt-1 text-[0.6875rem] text-[var(--text-faint)]">{hint}</p>}
    </div>
  );
}
