"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { localeNames, localeShort, routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * Three languages, three buttons, one click each.
 *
 * This was a dropdown: click to open, read, click to choose. For a switch
 * people use constantly — and for a trilingual audience where plenty of readers
 * will land in the wrong language — that is one interaction too many. All three
 * options are on screen at all times, so switching is a single tap and you can
 * see what you are switching *from* without opening anything.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const active = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === active) return;
    // Keeps the current route; next-intl rewrites the prefix.
    startTransition(() => router.replace(pathname, { locale: next }));
  }

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-[var(--line-subtle)]",
        "bg-[var(--surface-raised)]/60 p-0.5 backdrop-blur",
        pending && "opacity-70",
        className,
      )}
    >
      {routing.locales.map((locale) => {
        const isActive = locale === active;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => switchTo(locale)}
            lang={locale}
            title={localeNames[locale]}
            aria-label={localeNames[locale]}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "relative rounded-full px-2 py-1 text-[0.625rem] font-semibold tracking-wide uppercase",
              "sm:px-2.5 sm:text-[0.6875rem]",
              "transition-[color,background-color] duration-300 ease-[var(--ease-calm)]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
              isActive
                ? "bg-[var(--accent-ground)] text-[var(--on-accent)]"
                : "text-[var(--text-muted)] hover:bg-[color-mix(in_oklab,var(--text-strong)_8%,transparent)] hover:text-[var(--text-strong)]",
            )}
          >
            {localeShort[locale]}
          </button>
        );
      })}
    </div>
  );
}
