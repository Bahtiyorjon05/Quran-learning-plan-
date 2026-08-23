"use client";

import { useEffect, useLayoutEffect } from "react";

/**
 * Keeps the chosen theme on <html> when React re-renders the document element.
 *
 * Switching language re-renders the root layout — the locale is a segment of
 * it — and React reconciles the real <html> element against the new payload.
 * Attributes React does not own are dropped, and `data-theme` is set by an
 * inline script rather than rendered, so it was being wiped on every language
 * switch. The palette is dark-first, so the absent attribute meant a reader who
 * had chosen light was thrown into the dark and stayed there.
 *
 * Removing the attribute from the server render did not help: React removes it
 * on the *client* re-render, not at hydration. This restores it instead.
 *
 * Two guards, both firing before the browser paints, so nothing flashes:
 *
 *   - a layout effect on every render, which runs after React has committed
 *     its DOM changes and before paint;
 *   - a MutationObserver, whose callback is a microtask, for anything that
 *     removes the attribute at some other moment.
 */

/* useLayoutEffect warns when it runs on the server. This component only does
   work in a browser, so the effect is chosen to match where it will run. */
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

const KEY = "ahd-theme";

function chosenTheme(): string {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(KEY);
  } catch {
    /* Private mode. The system preference is the honest fallback. */
  }
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function restoreIfMissing() {
  const root = document.documentElement;
  if (root.getAttribute("data-theme")) return;
  root.setAttribute("data-theme", chosenTheme());
}

export function ThemeGuard() {
  /* Deliberately no dependency array. The attribute is lost exactly when the
     layout re-renders, and next-intl's pathname does not change when only the
     locale does — so there is nothing to depend on but the render itself. */
  useBeforePaint(restoreIfMissing);

  useEffect(() => {
    const observer = new MutationObserver(restoreIfMissing);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return null;
}
