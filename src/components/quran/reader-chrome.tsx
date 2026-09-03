"use client";

import { useEffect } from "react";

/**
 * Gets the furniture out of the way while somebody is reading.
 *
 * A mushaf page is a column of Arabic that wants the whole screen. Above it sat
 * two fixed bars — the wordmark, three language buttons, the theme toggle, the
 * way out, then the surah name and the page arrows — nearly a third of a phone
 * screen, permanently, while the reader's eye was somewhere near the bottom
 * following a recitation.
 *
 * So: scrolling down takes the bars away, scrolling up brings them back. The
 * player does not go with them, because it is the one thing wanted *while*
 * reading; it slides up into the space the bars leave.
 *
 * Written as an attribute on the document rather than as React state on
 * purpose. The bars belong to three different layouts and the player to a
 * fourth, and threading a boolean through all of them would mean re-rendering
 * a page of server-rendered Arabic on every scroll — which is the one thing
 * this reader must never do.
 */

/** Far enough down that the bars are not flickering at the top of the page. */
const ENGAGED = 150;

/** Ignore the jitter of a finger resting on a screen. */
const MEANINGFUL = 6;

export function ReaderChrome() {
  useEffect(() => {
    const root = document.documentElement;
    let last = window.scrollY;
    let frame = 0;

    const settle = () => {
      frame = 0;
      const y = window.scrollY;
      const moved = y - last;

      if (Math.abs(moved) < MEANINGFUL) return;

      /* Near the top the bars always come back, whatever the direction: that is
         where somebody goes to leave the page or change language, and having to
         scroll up and then a little further is a puzzle. */
      root.dataset.chrome = y < ENGAGED ? "shown" : moved > 0 ? "hidden" : "shown";
      last = y;
    };

    const onScroll = () => {
      /* Coalesced to a frame — a scroll handler that writes to the DOM on every
         event is how a long page starts to stutter on a phone. */
      if (frame === 0) frame = requestAnimationFrame(settle);
    };

    root.dataset.chrome = "shown";
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      /* Leaving the reader must not leave the rest of the site headless. */
      delete root.dataset.chrome;
    };
  }, []);

  return null;
}
