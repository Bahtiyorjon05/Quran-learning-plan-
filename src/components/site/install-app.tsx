"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDownToLine, Share, SquarePlus, X } from "lucide-react";

import {
  useAppleBrowser,
  useLocalValue,
  useStandalone,
  writeLocal,
} from "@/lib/client-store";
import { cn } from "@/lib/utils";

/**
 * Offering to install the app, and registering the worker that makes it useful.
 *
 * Two platforms, two entirely different mechanisms:
 *
 *   Android / desktop  the browser fires `beforeinstallprompt` when it judges
 *                      the site installable, and hands over a prompt that must
 *                      be called from a real gesture. So the event is captured
 *                      and kept, and the button spends it.
 *
 *   iOS                Safari has no such event and never will. Installing is
 *                      Share → Add to Home Screen, done by hand, so the only
 *                      honest thing is to say those words.
 *
 * It shows once. Someone who dismissed it has answered the question, and a
 * banner that returns every visit is the reason people distrust banners.
 */

const DISMISSED_KEY = "ahd-install-dismissed";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Registers the worker. Rendered once, in the layout, and draws nothing. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    /* After load: registering during it competes with the page's own requests
       for a connection, on the one visit where speed matters most. */
    const register = () => void navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}

export function InstallApp({ variant = "card" }: { variant?: "card" | "banner" }) {
  const t = useTranslations("install");

  const dismissed = useLocalValue(DISMISSED_KEY) === "true";
  /* Facts about the environment, not state: read where they live. */
  const standalone = useStandalone();
  const ios = useAppleBrowser();

  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      /* Kept rather than fired. Chrome only honours `prompt()` inside a user
         gesture, so the browser's own moment is the wrong one. */
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    const onInstalled = () => setJustInstalled(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone || justInstalled || dismissed) return null;
  /* Nothing to say on a browser that offers no way to install. */
  if (!prompt && !ios) return null;

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    if (outcome === "dismissed") writeLocal(DISMISSED_KEY, "true");
  }

  const body = ios ? t("iosHow") : t("body");

  return (
    <div
      className={cn(
        "relative flex items-start gap-4 rounded-2xl border p-5",
        "border-[var(--line-strong)] bg-[var(--surface-raised)]/50",
        variant === "banner" && "sm:items-center",
      )}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-overlay)]">
        <ArrowDownToLine className="h-4.5 w-4.5 text-[var(--accent)]" strokeWidth={1.6} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="pe-6 text-[0.9375rem] font-medium text-[var(--text-strong)]">
          {t("title")}
        </p>
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">{body}</p>

        {ios ? (
          /* The two taps, drawn, because "Share then Add to Home Screen" is a
             sentence nobody parses on a phone. */
          <p className="mt-3 flex flex-wrap items-center gap-2 text-[0.75rem] text-[var(--text-faint)]">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line-subtle)] px-2 py-1">
              <Share className="h-3.5 w-3.5" />
              {t("iosShare")}
            </span>
            <span aria-hidden>→</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line-subtle)] px-2 py-1">
              <SquarePlus className="h-3.5 w-3.5" />
              {t("iosAdd")}
            </span>
          </p>
        ) : (
          <button
            type="button"
            onClick={install}
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-full bg-[var(--accent-ground)] px-4 text-[0.8125rem] font-medium text-[var(--on-accent)] transition-[background-color] duration-300 hover:bg-[var(--accent-strong)]"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            {t("action")}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => writeLocal(DISMISSED_KEY, "true")}
        aria-label={t("dismiss")}
        className="absolute end-3 top-3 grid h-7 w-7 place-items-center rounded-full text-[var(--text-faint)] transition-colors duration-300 hover:bg-[var(--surface-overlay)] hover:text-[var(--text-strong)]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
