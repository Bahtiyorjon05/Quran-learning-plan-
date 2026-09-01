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
 * Offering to install the app.
 *
 * Two platforms, two entirely different mechanisms:
 *
 *   Android / desktop  the browser fires `beforeinstallprompt` when it judges
 *                      the site installable, and hands over a prompt that must
 *                      be spent inside a real gesture. So the event is captured
 *                      and kept, and the button spends it.
 *
 *   iOS                Safari has no such event and never will. Installing is
 *                      Share → Add to Home Screen, by hand, so the only honest
 *                      thing is to show those two taps.
 *
 * Whether to offer at all is not a decision this makes. The browser stops
 * firing the event once the app is installed and starts again if it is
 * deleted, so "is it installed" is answered by the platform rather than by a
 * flag of ours that would drift out of step with reality.
 *
 * Two surfaces, deliberately different:
 *
 *   the icon   lives in the header. Never dismissable, because it is one
 *              small button and because it is the thing that has to come back
 *              when somebody installs the app and later removes it.
 *
 *   the card   explains itself, and can be sent away. That dismissal expires,
 *              and is cleared outright the moment the app is installed — so a
 *              reader who dismissed the card a year ago, installed later, and
 *              then deleted the app is offered it again rather than being
 *              silently written off forever.
 */

const DISMISSED_KEY = "ahd-install-dismissed";

/** How long a dismissal of the card is honoured. */
const DISMISSAL_DAYS = 30;

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

/**
 * Everything both surfaces need to know.
 *
 * `offer` is true only when there is genuinely something to do: the browser
 * has offered a prompt, or this is an iPhone where the reader can do it by
 * hand — and in neither case is the app already installed.
 */
function useInstall() {
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

    const onInstalled = () => {
      setJustInstalled(true);
      setPrompt(null);
      /* Cleared, not kept. If this app is deleted later the browser will offer
         again, and an old dismissal must not swallow that offer. */
      writeLocal(DISMISSED_KEY, "");
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const installed = standalone || justInstalled;

  async function install(): Promise<"accepted" | "dismissed" | "manual"> {
    if (!prompt) return "manual";
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    return outcome;
  }

  return { offer: !installed && (Boolean(prompt) || ios), ios, canPrompt: Boolean(prompt), install };
}

/**
 * Whether the card was sent away recently enough to still be honoured.
 *
 * Render only asks whether a dismissal is stored; an expired one is cleared in
 * an effect, and the next render sees nothing. Comparing against the clock
 * during render would be an impure read — and the answer would then change
 * underneath React without anything telling it to look again.
 */
function useDismissed(): boolean {
  const raw = useLocalValue(DISMISSED_KEY);

  useEffect(() => {
    if (!raw) return;
    const at = Number(raw);
    const expired = !Number.isFinite(at) || Date.now() - at >= DISMISSAL_DAYS * 86_400_000;
    if (expired) writeLocal(DISMISSED_KEY, "");
  }, [raw]);

  return Boolean(raw);
}

/* ── The icon in the header ──────────────────────────────────────────────── */

/**
 * One button, always there while the app can be installed.
 *
 * Not dismissable on purpose: a header icon costs almost nothing, and this is
 * the surface that has to reappear for somebody who installed the app in March
 * and deleted it in June.
 */
export function InstallButton({ className }: { className?: string }) {
  const t = useTranslations("install");
  const { offer, ios, install } = useInstall();
  const [showing, setShowing] = useState(false);

  if (!offer) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (ios ? setShowing((open) => !open) : void install())}
        aria-label={t("title")}
        title={t("title")}
        aria-expanded={ios ? showing : undefined}
        className={cn(
          "inline-grid h-9 w-9 shrink-0 place-items-center rounded-full border",
          "border-[var(--accent)]/40 text-[var(--accent-strong)]",
          "transition-colors duration-300 hover:bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]",
          className,
        )}
      >
        <ArrowDownToLine className="h-4 w-4" />
      </button>

      {/* iOS cannot be prompted, so the button explains instead. */}
      {ios && showing && (
        <div
          role="dialog"
          aria-label={t("title")}
          className="animate-rise absolute end-0 top-11 z-50 w-64 rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-raised)] p-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.55)]"
        >
          <p className="text-[0.8125rem] font-medium text-[var(--text-strong)]">{t("title")}</p>
          <p className="mt-1.5 text-[0.75rem] leading-relaxed text-[var(--text-muted)]">
            {t("iosHow")}
          </p>
          <IosSteps t={t} />
        </div>
      )}
    </div>
  );
}

function IosSteps({ t }: { t: (key: string) => string }) {
  return (
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
  );
}

/* ── The card ────────────────────────────────────────────────────────────── */

export function InstallApp({ variant = "card" }: { variant?: "card" | "banner" }) {
  const t = useTranslations("install");
  const { offer, ios, install } = useInstall();
  const dismissed = useDismissed();

  if (!offer || dismissed) return null;

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
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
          {ios ? t("iosHow") : t("body")}
        </p>

        {ios ? (
          <IosSteps t={t} />
        ) : (
          <button
            type="button"
            onClick={async () => {
              const outcome = await install();
              if (outcome === "dismissed") writeLocal(DISMISSED_KEY, String(Date.now()));
            }}
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-full bg-[var(--accent-ground)] px-4 text-[0.8125rem] font-medium text-[var(--on-accent)] transition-[background-color] duration-300 hover:bg-[var(--accent-strong)]"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            {t("action")}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => writeLocal(DISMISSED_KEY, String(Date.now()))}
        aria-label={t("dismiss")}
        className="absolute end-3 top-3 grid h-7 w-7 place-items-center rounded-full text-[var(--text-faint)] transition-colors duration-300 hover:bg-[var(--surface-overlay)] hover:text-[var(--text-strong)]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
