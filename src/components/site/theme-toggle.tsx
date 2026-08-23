"use client";

import { useTranslations } from "next-intl";
import { Moon, Sun, BookOpen } from "lucide-react";

import { useThemeAttribute, writeLocal } from "@/lib/client-store";
import { cn } from "@/lib/utils";

const THEMES = ["dark", "light", "sepia"] as const;
type Theme = (typeof THEMES)[number];

const ICON = { dark: Moon, light: Sun, sepia: BookOpen } as const;

function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value);
}

/**
 * The theme lives on <html>, not in React state.
 *
 * An inline script sets it before first paint so the wrong theme never flashes,
 * which makes the DOM the source of truth. Reading it through
 * useSyncExternalStore means the first client render is already correct —
 * no effect, no second render, and no icon appearing a frame late.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const attribute = useThemeAttribute("dark");
  const theme: Theme = isTheme(attribute) ? attribute : "dark";

  function cycle() {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    document.documentElement.setAttribute("data-theme", next);
    writeLocal("ahd-theme", next);
  }

  const Icon = ICON[theme];
  const label = t(
    theme === "dark" ? "themeDark" : theme === "light" ? "themeLight" : "themeSepia",
  );

  return (
    <button
      type="button"
      onClick={cycle}
      title={`${t("theme")}: ${label}`}
      aria-label={`${t("theme")}: ${label}`}
      className={cn(
        "inline-grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--line-subtle)]",
        "text-[var(--text-muted)] transition-colors duration-300 hover:border-[var(--line-strong)] hover:text-[var(--text-strong)]",
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
