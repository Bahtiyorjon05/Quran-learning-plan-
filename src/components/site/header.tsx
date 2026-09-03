"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Wordmark } from "@/components/brand/logo";
import { buttonStyles } from "@/components/ui/button";
import { InstallApp, InstallButton } from "./install-app";
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

  // Lock the page while the sheet is open, and close it on Escape.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
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
        <div className="measure flex h-16 items-center justify-between gap-3 sm:h-18 sm:gap-4">
          <Link href="/" aria-label="Ahd" className="shrink-0">
            <Wordmark priority size={32} />
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

          {/* Language and theme sit here at every width, phones included. They
              are the two controls someone reaches for the instant they land in
              the wrong language or the wrong brightness, and burying either
              behind a hamburger makes people leave rather than adjust. */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <InstallButton />
            <LanguageSwitcher />
            <ThemeToggle />

            <Link
              href="/login"
              className="hidden rounded-full px-3.5 py-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)] lg:inline-flex"
            >
              {t("login")}
            </Link>

            {/* The primary action is dropped on phones: with the two controls
                above it, the row would overflow a 320px screen. The hero
                carries the same button one scroll down, and the sheet has it. */}
            <Link
              href="/signup"
              className={buttonStyles({ size: "sm", className: "hidden lg:inline-flex" })}
            >
              {t("signup")}
            </Link>

            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={t("menu")}
              aria-expanded={open}
              className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--line-subtle)] text-[var(--text-muted)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--text-strong)] lg:hidden"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Sheet ─────────────────────────────────────────────────────────── */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("menu")}
          className="fixed inset-0 z-[100] lg:hidden"
        >
          {/* Fully opaque. At 95% the header showed through the panel, so two
              wordmarks sat almost exactly on top of each other. */}
          <div
            className="absolute inset-0 bg-[var(--surface-base)]"
            onClick={() => setOpen(false)}
          />
          <div aria-hidden className="girih absolute inset-0 opacity-[0.03]" />

          <div className="measure relative flex h-full flex-col">
            <div className="flex h-16 items-center justify-between sm:h-18">
              <Wordmark size={32} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("close")}
                className="inline-grid h-9 w-9 place-items-center rounded-full border border-[var(--line-subtle)] text-[var(--text-muted)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--text-strong)]"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <nav className="mt-8 flex flex-col" aria-label="Mobile">
              {LINKS.map((l, i) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  style={{ animationDelay: `${i * 55}ms` }}
                  className="animate-rise border-b border-[var(--line-subtle)] py-4 font-[family-name:var(--font-display)] text-[1.75rem] leading-tight font-light text-[var(--text-strong)] transition-colors hover:text-[var(--accent-strong)]"
                >
                  {t(l.key)}
                </Link>
              ))}
            </nav>

            <div
              className="animate-rise mt-auto flex flex-col gap-3 py-8"
              style={{ animationDelay: `${LINKS.length * 55}ms` }}
            >
              {/* The sheet is where there is room to say what installing gets
                  you. The header keeps the bare icon, for anyone who already
                  knows. Both draw nothing where installing is impossible. */}
              <InstallApp />

              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className={buttonStyles({ size: "lg", className: "w-full" })}
              >
                {t("signup")}
              </Link>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className={buttonStyles({
                  variant: "outline",
                  size: "lg",
                  className: "w-full",
                })}
              >
                {t("login")}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
