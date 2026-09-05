"use client";

import { useEffect, useRef } from "react";

/**
 * The screen stays on while the mushaf is open.
 *
 * Reading and listening are the two things you do on this screen without
 * touching it. A page of Qur'an takes minutes to recite and longer to sit
 * with, and every phone in the world decides after thirty seconds of stillness
 * that nobody is there — so the light goes out mid-ayah and you break your
 * recitation to wake it up. That is the whole problem this solves.
 *
 * Three details make the difference between working and almost working:
 *
 *   · the lock is released by the browser whenever the page is hidden — a
 *     phone call, switching apps, the screen locked by the button. It is not
 *     given back automatically, so returning to the page has to ask again, or
 *     the screen sleeps for the rest of the session.
 *
 *   · the request must be made while the document is visible. Asking from a
 *     hidden page throws, which is why the mount path checks first rather than
 *     trusting that a freshly mounted component is on screen.
 *
 *   · it is released on the way out. Leaving the reader means the lock has
 *     done its job, and a wake lock outliving the screen that needed it is how
 *     an app earns a reputation for eating batteries.
 *
 * Support is not universal — Firefox on Android and older iOS have none — so
 * every path is guarded and failure is silent. A screen that dims is the
 * behaviour people already expect; an error about it would be noise.
 *
 * Renders nothing.
 */
export function KeepAwake() {
  /* Held in a ref rather than state: nothing renders from it, and setting
     state here would re-render the whole reader for a fact the reader does not
     display. */
  const lock = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    let dropped = false;

    async function hold() {
      if (dropped || document.visibilityState !== "visible") return;
      /* `released` rather than merely "we have a reference". The browser drops
         the lock when the page is hidden, and the release event that clears
         this ref is not guaranteed to have arrived by the time visibility
         comes back — on that ordering a truthy ref meant we never asked again
         and the screen slept for the rest of the session. */
      if (lock.current && !lock.current.released) return;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (dropped) {
          void sentinel.release().catch(() => {});
          return;
        }
        lock.current = sentinel;
        /* The browser can drop it on its own — a low battery, a policy change.
           Clearing the ref means the next visibility change asks again rather
           than believing it still holds one. */
        sentinel.addEventListener("release", () => {
          if (lock.current === sentinel) lock.current = null;
        });
      } catch {
        /* Refused: not allowed here, battery saver, or a browser that lists
           the API and declines to honour it. The screen dims, as it always
           did. */
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") void hold();
    };

    void hold();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      dropped = true;
      document.removeEventListener("visibilitychange", onVisible);
      const held = lock.current;
      lock.current = null;
      void held?.release().catch(() => {});
    };
  }, []);

  return null;
}
