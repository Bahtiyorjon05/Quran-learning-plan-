"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Bell, BellOff, BellRing, Check, Loader2 } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { subscribeThisDevice } from "@/lib/push-client";
import { cn } from "@/lib/utils";

/**
 * The bell in the header, and the one honest thing it can say.
 *
 * There was no way to reach notifications from the screen people actually open
 * every morning — they lived at the bottom of settings, which is where things
 * go to be forgotten. Worse, "allowed" and "will actually arrive" are
 * different facts, and a bell that showed only the first would be the same
 * empty promise the old switch was.
 *
 * So it draws the real state of *this device*: not asked, asked and refused,
 * or genuinely subscribed. Turning it on is one tap, and it asks the browser
 * and registers the device in the same gesture — permission on its own
 * delivers nothing.
 *
 * Hidden entirely where the browser cannot do it at all. A control that can
 * never work is worse than no control.
 */

type Permission = "granted" | "denied" | "default" | "unsupported";

function readPermission(): Permission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  return Notification.permission as Permission;
}

function usePermission(): Permission {
  return useSyncExternalStore(
    () => () => {},
    readPermission,
    /* The server has no opinion, and guessing one would flash the wrong icon
       for a frame before hydration corrects it. */
    () => "unsupported" as Permission,
  );
}

export function NotificationBell() {
  const t = useTranslations("settings");
  const initial = usePermission();
  const [asked, setAsked] = useState<Permission | null>(null);
  const permission = asked ?? initial;

  const [open, setOpen] = useState(false);
  const [busy, startBusy] = useTransition();
  const [done, setDone] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (permission === "unsupported") return null;

  const on = permission === "granted";
  const Icon = on ? BellRing : permission === "denied" ? BellOff : Bell;

  function enable() {
    startBusy(async () => {
      try {
        const granted = (await Notification.requestPermission()) as Permission;
        setAsked(granted);
        if (granted === "granted") {
          await subscribeThisDevice();
          setDone(true);
        }
      } catch {
        setAsked("denied");
      }
    });
  }

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-label={t("notifications")}
        title={t("notifications")}
        className={cn(
          "relative inline-grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors duration-300",
          on
            ? "border-[var(--accent)]/40 text-[var(--accent-strong)] hover:bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]"
            : "border-[var(--line-subtle)] text-[var(--text-muted)] hover:border-[var(--line-strong)] hover:text-[var(--text-strong)]",
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.7} />
        {/* A quiet dot rather than a red badge: this is an invitation, not an
            unread count, and nothing here is urgent. */}
        {permission === "default" && (
          <span
            aria-hidden
            className="absolute end-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--gold)]"
          />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("notifications")}
          className="animate-rise absolute end-0 top-11 z-50 w-72 rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-raised)] p-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.55)]"
        >
          <p className="text-[0.875rem] font-medium text-[var(--text-strong)]">
            {on ? t("pushOn") : t("pushOff")}
          </p>
          <p className="mt-1.5 text-[0.75rem] leading-relaxed text-[var(--text-muted)]">
            {permission === "denied"
              ? t("pushBlocked")
              : on
                ? t("remindersHint")
                : t("pushHint")}
          </p>

          {permission === "default" && (
            <button
              type="button"
              onClick={enable}
              disabled={busy}
              className="mt-3.5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent-ground)] text-[0.8125rem] font-medium text-[var(--on-accent)] transition-[background-color] duration-300 hover:bg-[var(--accent-strong)] disabled:opacity-60"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("pushEnable")}
            </button>
          )}

          {done && (
            <p className="mt-3 flex items-center gap-1.5 text-[0.75rem] text-[var(--accent-strong)]">
              <Check className="h-3.5 w-3.5" />
              {t("pushReady")}
            </p>
          )}

          <Link
            href="/app/settings"
            onClick={() => setOpen(false)}
            className="mt-3 block text-[0.75rem] text-[var(--text-faint)] transition-colors hover:text-[var(--text-strong)]"
          >
            {t("title")}
          </Link>
        </div>
      )}
    </div>
  );
}
