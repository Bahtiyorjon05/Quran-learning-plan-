"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, LogOut, Settings, ShieldCheck } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { logoutAction } from "@/app/[locale]/app/actions";
import { InstallMenuItem } from "@/components/site/install-app";
import { cn } from "@/lib/utils";

/**
 * Everything about *you*, behind one control.
 *
 * The header used to line these up as separate icons — admin, settings,
 * install, language, theme, log out — which on a phone was six round buttons
 * and a wordmark fighting over 390 pixels. They overlapped, and the ones that
 * mattered least were as loud as the ones that mattered most.
 *
 * So the split is by kind rather than by convenience. Language and theme stay
 * out in the open: they change how the page in front of you reads, they are
 * used mid-sentence, and burying them behind a menu would cost a tap every
 * time. Everything that is about the account rather than the page — your name,
 * settings, installing, the way in to admin, the way out — collects here.
 *
 * Closing is handled three ways because there are three ways to leave: click
 * elsewhere, press Escape, or follow a link. The last is done on the link
 * itself rather than by watching the route, so the menu is already gone during
 * the navigation instead of blinking away after it.
 */
export function AccountMenu({
  name,
  email,
  isAdmin,
}: {
  name: string;
  email: string;
  isAdmin: boolean;
}) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onDown = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /* A name can be empty on an account that never filled one in, and an initial
     drawn from an empty string is a blank circle. */
  const initial = (name || email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("account")}
        /* Server-rendered, so "was this browser told it belongs to an admin"
           can be asked of the HTML. The admin link itself only exists once the
           menu is opened, which leaves nothing to check without driving a
           browser — and the answer to that question is worth checking. */
        data-admin={isAdmin ? "true" : undefined}
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border ps-1 pe-2.5",
          "border-[var(--line-subtle)] transition-colors duration-300",
          "hover:border-[var(--line-strong)]",
          open && "border-[var(--line-strong)] bg-[var(--surface-overlay)]",
        )}
      >
        <span
          aria-hidden
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent-ground)] text-[0.8125rem] font-semibold text-[var(--on-accent)]"
        >
          {initial}
        </span>
        {/* The name is worth the room on a laptop and is the first thing to go
            on a phone, where the avatar already says whose account this is. */}
        <span className="hidden max-w-[9rem] truncate text-sm text-[var(--text-muted)] sm:block">
          {name || email}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-[var(--text-faint)] transition-transform duration-300",
            open && "rotate-180",
          )}
          strokeWidth={2}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("account")}
          className={cn(
            "animate-rise z-50 overflow-hidden rounded-2xl border",
            "border-[var(--line-strong)] bg-[var(--surface-raised)]",
            "shadow-[0_20px_50px_-20px_rgba(0,0,0,0.55)]",
            /* Same reasoning as the bell: hung off the trigger on a laptop,
               spanning the viewport on a phone rather than reaching past its
               edge. */
            "max-sm:fixed max-sm:inset-x-3 max-sm:top-[4.25rem]",
            "sm:absolute sm:end-0 sm:top-11 sm:w-64",
          )}
        >
          <div className="border-b border-[var(--line-subtle)] px-4 py-3">
            <p className="truncate text-[0.875rem] font-medium text-[var(--text-strong)]">
              {name || t("account")}
            </p>
            <p className="truncate text-[0.75rem] text-[var(--text-faint)]">{email}</p>
          </div>

          <div className="p-1.5">
            <Link
              href="/app/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={itemStyles}
            >
              <Settings className="h-4 w-4 shrink-0 text-[var(--text-faint)]" strokeWidth={1.7} />
              {t("settings")}
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={cn(itemStyles, "text-[var(--status-warning-ink)]")}
              >
                <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={1.7} />
                Admin
              </Link>
            )}

            <InstallMenuItem className={itemStyles} />

            <form action={logoutAction}>
              <button type="submit" role="menuitem" className={cn(itemStyles, "w-full")}>
                <LogOut className="h-4 w-4 shrink-0 text-[var(--text-faint)]" strokeWidth={1.7} />
                {t("logout")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const itemStyles = cn(
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-start text-[0.875rem]",
  "text-[var(--text-muted)] transition-colors duration-200",
  "hover:bg-[var(--surface-overlay)] hover:text-[var(--text-strong)]",
);
