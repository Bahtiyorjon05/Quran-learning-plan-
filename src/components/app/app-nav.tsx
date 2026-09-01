"use client";

import { useTranslations } from "next-intl";
import { BookOpen, LayoutDashboard, Sparkles, Target } from "lucide-react";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Where you can go, on two devices that want different answers.
 *
 * On a laptop the destinations sit in the header, where the eye already is.
 * On a phone they sit at the bottom, within reach of a thumb — this is an
 * application people open every morning, often one-handed, and a row of icons
 * squeezed into a top bar beside three language buttons and a theme toggle was
 * neither reachable nor legible.
 *
 * The active destination is marked in both, which the old header never did: it
 * gave no clue where you were.
 */

const DESTINATIONS = [
  { href: "/app", icon: LayoutDashboard, key: "nav.dashboard" },
  { href: "/app/practice", icon: Sparkles, key: "practice.title" },
  { href: "/app/mistakes", icon: Target, key: "mistakes.title" },
  { href: "/app/quran", icon: BookOpen, key: "app.mushaf.title" },
] as const;

/** Whether a destination owns the current page. */
function isCurrent(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavDesktop() {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 lg:flex" aria-label="App">
      {DESTINATIONS.map(({ href, icon: Icon, key }) => {
        const current = isCurrent(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm",
              "transition-[color,background-color] duration-300 ease-[var(--ease-calm)]",
              current
                ? "bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] font-medium text-[var(--accent-strong)]"
                : "text-[var(--text-muted)] hover:bg-[color-mix(in_oklab,var(--text-strong)_6%,transparent)] hover:text-[var(--text-strong)]",
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={current ? 2 : 1.7} />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The bottom bar, phones only.
 *
 * Sits above the home indicator on iOS via safe-area padding, and is hidden
 * from a laptop entirely rather than being a duplicate of the header.
 */
export function AppTabBar() {
  const t = useTranslations();
  const pathname = usePathname();

  /* `data-app-tabbar` is the marker the stylesheet looks for: the body gets
     bottom padding while this bar exists, so the last row of any page clears
     it. A spacer element cannot do that job — it would sit where the bar is
     rendered, near the top of the page, rather than at the bottom where the
     gap is actually needed. */
  return (
    <nav
      data-app-tabbar
      aria-label="App"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 lg:hidden",
        "border-t border-[var(--line-subtle)]",
        "bg-[color-mix(in_oklab,var(--surface-base)_92%,transparent)] backdrop-blur-xl",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <div className="mx-auto flex max-w-md items-stretch">
        {DESTINATIONS.map(({ href, icon: Icon, key }) => {
          const current = isCurrent(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={current ? "page" : undefined}
              className="group relative flex flex-1 flex-col items-center gap-1 px-2 pt-3 pb-2.5"
            >
              {/* A short bar above the icon rather than a filled pill: it
                    reads at a glance and does not crowd a 48px-wide target. */}
              <span
                aria-hidden
                className={cn(
                  "absolute top-0 h-0.5 w-8 rounded-b-full transition-[background-color,width] duration-300 ease-[var(--ease-calm)]",
                  current ? "bg-[var(--accent)]" : "w-0 bg-transparent",
                )}
              />
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors duration-300",
                  current ? "text-[var(--accent)]" : "text-[var(--text-faint)]",
                )}
                strokeWidth={current ? 2 : 1.6}
              />
              <span
                className={cn(
                  "text-[0.6875rem] leading-none transition-colors duration-300",
                  current
                    ? "font-medium text-[var(--accent-strong)]"
                    : "text-[var(--text-faint)]",
                )}
              >
                {t(key)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
