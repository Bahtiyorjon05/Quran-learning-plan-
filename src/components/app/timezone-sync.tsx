"use client";

import { useEffect } from "react";

import { syncTimeZone } from "@/app/[locale]/app/settings/actions";

/**
 * Keeps the day boundary where the reader actually is.
 *
 * The zone is captured once at onboarding, which is right until somebody gets
 * on a plane. After that every date in the product is computed somewhere they
 * are not: the day rolls over at the wrong hour, today's sheet arrives in the
 * middle of the night, and a streak breaks for no reason they can see.
 *
 * So it is checked on each visit to the dashboard and corrected when it has
 * genuinely changed. Silent on purpose — asking somebody to confirm which
 * country they are in, when the browser already knows, is a question with only
 * one sensible answer.
 *
 * Renders nothing. It is a fact about the device being reported once.
 */
export function TimeZoneSync({ current }: { current: string }) {
  useEffect(() => {
    let here: string | undefined;
    try {
      here = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }

    if (!here || here === current) return;
    void syncTimeZone(here).catch(() => {
      /* A failed sync is not worth interrupting anybody for; the next visit
         will try again. */
    });
  }, [current]);

  return null;
}
