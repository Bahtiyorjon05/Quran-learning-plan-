"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Wordmark } from "@/components/brand/logo";
import { buttonStyles } from "@/components/ui/button";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/#covenant", key: "howItWorks" },
  { href: "/#features", key: "features" },
  { href: "/quran", key: "quran" },
  { href: "/about", key: "about" },
] as const;

export function Header() {
  const t = useTranslations("nav");
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock the page while the mobile sheet is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[var(--accent-ground)] focus:px-4 focus:py-2 focus:text-sm focus:text-[var(--on-accent)]"
      >
        {t("skipToContent")}
      </a>

      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500 ease-[var(--ease-calm)]",
          scrolled
            ? "border-b border-[var(--line-subtle)] bg-[color-mix(in_oklab,var(--surface-base)_82%,transparent)] backdrop-blur-xl"
            : "border-b border-transparent",
        )}
      >
        <div className="measure flex h-16 items-center justify-between gap-4 sm:h-18">
          <Link href="/" aria-label="Ahd" className="shrink-0">
            <Wordmark priority />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full px-3.5 py-2 text-sm text-[var(--text-muted)] transition-colors duration-300 hover:bg-[color-mix(in_oklab,var(--text-strong)_6%,transparent)] hover:text-[var(--text-strong)]"
              >
                {t(l.key)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle className="hidden sm:inline-grid" />
            <Link
              href="/login"
              className="hidden rounded-full px-3.5 py-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)] sm:inline-flex"
            >
              {t("login")}
            </Link>
            <Link href="/signup" className={buttonStyles({ size: "sm" })}>
              {t("signup")}
            </Link>

            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={t("menu")}
              className="inline-grid h-9 w-9 place-items-center rounded-full border border-[var(--line-subtle)] text-[var(--text-muted)] lg:hidden"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile sheet ── */}
      {open && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div
            className="absolute inset-0 bg-[var(--surface-base)]/95 backdrop-blur-xl"
            onClick={() => setOpen(false)}
          />
          <div className="measure relative flex h-full flex-col">
            <div className="flex h-16 items-center justify-between sm:h-18">
              <Wordmark />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("close")}
                className="inline-grid h-9 w-9 place-items-center rounded-full border border-[var(--line-subtle)] text-[var(--text-muted)]"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <nav className="mt-6 flex flex-col gap-1" aria-label="Mobile">
              {LINKS.map((l, i) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  style={{ animationDelay: `${i * 55}ms` }}
                  className="animate-rise border-b border-[var(--line-subtle)] py-4 font-[family-name:var(--font-display)] text-2xl font-light text-[var(--text-strong)]"
                >
                  {t(l.key)}
                </Link>
              ))}
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                style={{ animationDelay: `${LINKS.length * 55}ms` }}
                className="animate-rise border-b border-[var(--line-subtle)] py-4 font-[family-name:var(--font-display)] text-2xl font-light text-[var(--text-strong)]"
              >
                {t("login")}
              </Link>
            </nav>

            <div className="mt-auto flex items-center gap-3 py-8">
              <LanguageSwitcher />
              <ThemeToggle />
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className={buttonStyles({ className: "ms-auto" })}
              >
                {t("signup")}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
