"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Globe, ChevronDown } from "lucide-react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, localeNames, localeShort, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(next: Locale) {
    setOpen(false);
    if (next === locale) return;
    // Preserve the current route; next-intl rewrites the prefix for us.
    startTransition(() => router.replace(pathname, { locale: next }));
  }

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("language")}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--line-subtle)] px-3",
          "text-sm text-[var(--text-muted)] transition-colors duration-300",
          "hover:border-[var(--line-strong)] hover:text-[var(--text-strong)]",
          pending && "opacity-60",
        )}
      >
        <Globe className="h-4 w-4" />
        <span className="font-medium tabular-nums">{localeShort[locale]}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t("language")}
          className={cn(
            "absolute end-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-[var(--line-strong)]",
            "bg-[var(--surface-overlay)] p-1 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]",
            "animate-rise",
          )}
        >
          {routing.locales.map((l) => (
            <li key={l}>
              <button
                type="button"
                role="option"
                aria-selected={l === locale}
                onClick={() => choose(l)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                  l === locale
                    ? "text-[var(--accent-strong)]"
                    : "text-[var(--text-default)] hover:bg-[color-mix(in_oklab,var(--text-strong)_7%,transparent)] hover:text-[var(--text-strong)]",
                )}
              >
                {localeNames[l]}
                {l === locale && <Check className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
