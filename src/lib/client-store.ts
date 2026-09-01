"use client";

import { useSyncExternalStore } from "react";

/**
 * Reading things that only exist in a browser, without setState in an effect.
 *
 * The obvious pattern — `useEffect(() => setValue(read()), [])` — renders once
 * with a placeholder, then immediately again with the real value, and React's
 * lint rule rightly calls that a cascading render. `useSyncExternalStore` is
 * the mechanism built for exactly this: it takes a server snapshot and a client
 * snapshot, so the first client render is already correct and hydration still
 * matches.
 *
 * Every `getSnapshot` here returns a primitive. Returning a fresh object or
 * array would make React see a change on every call and loop forever.
 */

/** A subscribe function for values that never change after hydration. */
const never = () => () => {};

/** True once hydrated, false while rendering on the server. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    never,
    () => true,
    () => false,
  );
}

/**
 * Whether a global exists in this environment.
 *
 * The server snapshot deliberately claims support: it is true of every browser
 * we care about, so the markup React sends matches what almost every client
 * will hydrate into, and the rare browser without it corrects itself silently.
 */
export function useSupports(name: "IntersectionObserver"): boolean {
  return useSyncExternalStore(
    never,
    () => typeof window !== "undefined" && name in window,
    () => true,
  );
}

/**
 * Whether the page is running from an installed icon rather than a browser tab.
 *
 * Read through the store rather than set in an effect: it is a fact about the
 * environment that is true before React starts, and calling setState for it
 * during an effect is a cascading render for no reason.
 */
export function useStandalone(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(display-mode: standalone)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(display-mode: standalone)").matches,
    () => false,
  );
}

/**
 * Whether this is Safari on an iPhone or iPad.
 *
 * The only browser that offers no install event at all, so the only one that
 * has to be told apart. iPadOS reports itself as a Mac, which is why touch
 * support is part of the test.
 */
export function useAppleBrowser(): boolean {
  return useSyncExternalStore(
    never,
    () => {
      const ua = navigator.userAgent;
      const apple =
        /iphone|ipod|ipad/i.test(ua) ||
        (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
      return apple && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    },
    () => false,
  );
}

/** The browser's IANA timezone, or "" on the server and where it is blocked. */
export function useTimeZone(): string {
  return useSyncExternalStore(
    never,
    () => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
      } catch {
        return "";
      }
    },
    () => "",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOCAL STORAGE, AS AN EXTERNAL STORE
   The `storage` event only fires in *other* tabs, so writing needs its own
   notification for the tab that made the change to re-render.
   ═══════════════════════════════════════════════════════════════════════════ */

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Private mode, or storage blocked. Defaults apply.
    return null;
  }
}

export function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* The change still applies for this render; it just will not survive. */
  }
  notify();
}

/** A stored string, kept in step with writes from anywhere in the app. */
export function useLocalValue(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => readLocal(key),
    () => null,
  );
}

/**
 * The theme currently on <html>.
 *
 * It is set by an inline script before first paint so the wrong theme never
 * flashes, which means the DOM — not React — is the source of truth. A
 * MutationObserver keeps the toggle honest if anything else changes it.
 */
export function useThemeAttribute(fallback: string): string {
  return useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      return () => observer.disconnect();
    },
    () => document.documentElement.getAttribute("data-theme") ?? fallback,
    () => fallback,
  );
}
