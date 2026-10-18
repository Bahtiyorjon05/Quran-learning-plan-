/**
 * The page somebody was last reading, remembered on this device.
 *
 * Kept in the browser rather than the database: it is a convenience — where
 * "continue" should land — and not a record anybody needs on another device or
 * in a report. Every read and write is guarded, because storage can be
 * blocked, full, or missing in a private window, and none of those is a reason
 * for the reader to fail.
 */

const KEY = "ahd-last-page";
const EVENT = "ahd-last-page";

export function rememberPage(page: number) {
  try {
    window.localStorage.setItem(KEY, String(page));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* Storage refused. Continue will fall back to today's lesson. */
  }
}

export function lastPage(): number | null {
  try {
    const n = Number(window.localStorage.getItem(KEY));
    return Number.isInteger(n) && n >= 1 && n <= 604 ? n : null;
  } catch {
    return null;
  }
}

/** For `useSyncExternalStore`: storage changes here or in another tab. */
export function subscribeLastPage(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
