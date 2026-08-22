"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const THEMES = ["dark", "light", "sepia"] as const;
type Theme = (typeof THEMES)[number];

const ICON = { dark: Moon, light: Sun, sepia: BookOpen } as const;

export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current && (THEMES as readonly string[]).includes(current)) {
      setTheme(current as Theme);
    }
    setMounted(true);
  }, []);

  function cycle() {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("ahd-theme", next);
    } catch {
      // Private mode or blocked storage — the theme still applies for this visit.
    }
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
        "inline-grid h-9 w-9 place-items-center rounded-full border border-[var(--line-subtle)]",
        "text-[var(--text-muted)] transition-colors duration-300 hover:border-[var(--line-strong)] hover:text-[var(--text-strong)]",
        className,
      )}
    >
      {/* Render nothing meaningful until mounted so SSR and client agree. */}
      <Icon className={cn("h-4 w-4 transition-opacity", mounted ? "opacity-100" : "opacity-0")} />
    </button>
  );
}
