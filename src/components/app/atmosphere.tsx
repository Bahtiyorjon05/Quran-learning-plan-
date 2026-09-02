"use client";

import { useSyncExternalStore } from "react";

/**
 * The ground behind every signed-in screen.
 *
 * Two blurred washes, a girih lattice and a vignette, fixed behind the content
 * and faded out before it reaches the fold. All of it is decorative; none of
 * it is ever between a finger and a control.
 *
 * The washes take their colour from the hour. This is not novelty: the whole
 * product is built around two moments — before Fajr and after Isha — and the
 * screen someone opens in the dark should not be lit the same way as the one
 * they open at noon. The daypart is read from the browser rather than the
 * server because the server does not know the reader's timezone, and it is
 * read through `useSyncExternalStore` so the first client render is already
 * correct and hydration has nothing to correct.
 */

type Daypart = "dawn" | "morning" | "afternoon" | "dusk" | "night";

function daypartAt(hour: number): Daypart {
  if (hour >= 4 && hour < 7) return "dawn";
  if (hour >= 7 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

function useDaypart(): Daypart {
  return useSyncExternalStore(
    /* Re-read on the hour rather than on a timer: a dashboard is often left
       open, and the ground going stale at sunrise is the one case worth
       catching. Nothing else can change it. */
    (onChange) => {
      const now = new Date();
      const msToNextHour =
        (60 - now.getMinutes()) * 60_000 - now.getSeconds() * 1000 + 500;
      const id = setTimeout(onChange, msToNextHour);
      return () => clearTimeout(id);
    },
    () => daypartAt(new Date().getHours()),
    /* Night on the server: dark is the default theme, so this is the guess
       that changes least when the real hour arrives. */
    () => "night" as Daypart,
  );
}

export function Atmosphere() {
  const daypart = useDaypart();

  return (
    <div className="ahd-ground" data-daypart={daypart} aria-hidden>
      <div className="ahd-ground-wash ahd-ground-wash-a" />
      <div className="ahd-ground-wash ahd-ground-wash-b" />
      <div className="ahd-ground-lattice girih" />
    </div>
  );
}
