"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Bell, BellOff, BellRing } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The browser's own permission, which no form can set.
 *
 * The switch above decides whether Ahd *wants* to remind somebody; this is
 * whether the device will let it. They are genuinely two different things and
 * conflating them is why "notifications are on" so often means nothing — the
 * preference says yes and the operating system has been saying no since the
 * day it was first asked.
 *
 * Only a gesture can ask for it, so this is a button rather than a toggle, and
 * once refused the browser will not ask again — which is said plainly instead
 * of leaving somebody pressing a button that cannot work.
 */

type Permission = "granted" | "denied" | "default" | "unsupported";

function readPermission(): Permission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as Permission;
}

/* Read through a store rather than an effect: it is a fact about the browser
   that is true before React starts, and the server has no opinion at all. */
function usePermission(): Permission {
  return useSyncExternalStore(
    () => () => {},
    readPermission,
    () => "default" as Permission,
  );
}

export function NotificationSetting() {
  const t = useTranslations("settings");
  const initial = usePermission();
  const [asked, setAsked] = useState<Permission | null>(null);
  const permission = asked ?? initial;

  async function ask() {
    if (permission !== "default") return;
    try {
      setAsked((await Notification.requestPermission()) as Permission);
    } catch {
      setAsked("denied");
    }
  }

  const tone =
    permission === "granted" ? "on" : permission === "default" ? "ask" : "off";

  const Icon = tone === "on" ? BellRing : tone === "ask" ? Bell : BellOff;

  return (
    <div className="flex items-start gap-3.5 border-t border-[var(--line-subtle)] pt-5">
      <span
        className={cn(
          "mt-0.5 grid h-6 w-10 shrink-0 place-items-center",
          tone === "on" ? "text-[var(--accent)]" : "text-[var(--text-faint)]",
        )}
      >
        <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-medium text-[var(--text-strong)]">
          {tone === "on" ? t("pushOn") : t("pushOff")}
        </span>
        <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
          {permission === "unsupported"
            ? t("pushUnsupported")
            : permission === "denied"
              ? t("pushBlocked")
              : t("remindersHint")}
        </span>
      </span>

      {permission === "default" && (
        <button
          type="button"
          onClick={ask}
          className="shrink-0 rounded-full border border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] px-3.5 py-1.5 text-[0.8125rem] font-medium text-[var(--accent-strong)] transition-colors duration-300 hover:bg-[color-mix(in_oklab,var(--accent)_18%,transparent)]"
        >
          {t("pushEnable")}
        </button>
      )}
    </div>
  );
}
