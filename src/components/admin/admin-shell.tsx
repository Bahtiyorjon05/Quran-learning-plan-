import { ArrowLeft, LayoutDashboard, ShieldCheck, Users } from "lucide-react";

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
          {/* The full sentence does not fit on a phone and truncating it to
              "Admin — you are seeing everyone…" is worse than saying less. */}
          <span className="max-sm:hidden">Admin — you are seeing everyone&rsquo;s data</span>
          <span className="sm:hidden">Admin — everyone&rsquo;s data</span>
        </Measure>
      </div>

      <header className="sticky top-0 z-40 border-b border-[var(--line-subtle)] bg-[color-mix(in_oklab,var(--surface-base)_88%,transparent)] backdrop-blur-xl">
        <Measure className="flex h-16 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-5">
            <Link href="/admin" aria-label="Ahd admin" className="shrink-0">
              <Wordmark priority size={30} />
            </Link>

            <nav className="hidden items-center gap-1 sm:flex" aria-label="Admin">
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
              className={buttonStyles({
                variant: "outline",
                size: "sm",
                className: "max-sm:hidden",
              })}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Back to the app
            </Link>
          </div>
        </Measure>
      </header>

      <main>{children}</main>

      {/* The same bottom bar the product uses, for the same reason: two
          destinations squeezed into a 390px header beside a theme toggle and a
          way out were neither reachable nor legible. `data-app-tabbar` is the
          marker the stylesheet already looks for to keep the last row of the
          page clear of it. */}
      <nav
        data-app-tabbar
        aria-label="Admin"
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 sm:hidden",
          "border-t border-[var(--line-subtle)]",
          "bg-[color-mix(in_oklab,var(--surface-base)_92%,transparent)] backdrop-blur-xl",
          "pb-[env(safe-area-inset-bottom)]",
        )}
      >
        <div className="mx-auto flex max-w-md items-stretch">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={tab.id === current ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center gap-1 px-2 pt-3 pb-2.5"
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-0 h-0.5 rounded-b-full transition-[background-color,width] duration-300 ease-[var(--ease-calm)]",
                  tab.id === current ? "w-8 bg-[var(--accent)]" : "w-0 bg-transparent",
                )}
              />
              <tab.icon
                className={cn(
                  "h-5 w-5",
                  tab.id === current ? "text-[var(--accent)]" : "text-[var(--text-faint)]",
                )}
                strokeWidth={tab.id === current ? 2 : 1.6}
              />
              <span
                className={cn(
                  "text-[0.6875rem] leading-none",
                  tab.id === current
                    ? "font-medium text-[var(--accent-strong)]"
                    : "text-[var(--text-faint)]",
                )}
              >
                {tab.label}
              </span>
            </Link>
          ))}

          <Link
            href="/app"
            className="relative flex flex-1 flex-col items-center gap-1 px-2 pt-3 pb-2.5"
          >
            <ArrowLeft className="h-5 w-5 text-[var(--text-faint)]" strokeWidth={1.6} />
            <span className="text-[0.6875rem] leading-none text-[var(--text-faint)]">
              The app
            </span>
          </Link>
        </div>
      </nav>
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
        /* min-w-0 is load-bearing. A grid item's default min-width is auto,
           which means a long unbreakable string inside — an email address, in
           practice — pushes the track wider than the viewport and the whole
           page slides sideways under the thumb. Measured at 583px in a 390px
           phone before this. */
        "panel min-w-0 rounded-2xl p-5 sm:p-6",
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
    <div className="panel min-w-0 rounded-2xl px-4 py-4 sm:px-5">
      <p
        className={cn(
          "font-[family-name:var(--font-display)] text-[1.75rem] leading-none font-light tabular-nums sm:text-[2rem]",
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
