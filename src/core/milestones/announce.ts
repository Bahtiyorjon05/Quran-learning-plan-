import "server-only";

import { getTranslations } from "next-intl/server";

import { pushToUser } from "@/push/send";
import type { Locale } from "@/i18n/routing";
import type { NewMilestone } from "./juz";

/**
 * Tell the person's other devices.
 *
 * The celebration on screen is for whoever is holding the phone. This is for
 * the laptop they left open, and for the record in their notification tray
 * afterwards — the one place a milestone survives being dismissed.
 *
 * Only the highest juz is announced when several land at once. Somebody
 * repairing a plan by hand can complete five juz in one tap, and five
 * notifications for one action reads as a bug rather than as five
 * congratulations.
 */
export async function announceJuz(
  userId: string,
  locale: Locale,
  milestones: NewMilestone[],
): Promise<void> {
  if (milestones.length === 0) return;

  const highest = milestones.reduce((max, m) => (m.juz > max.juz ? m : max), milestones[0]);

  try {
    const t = await getTranslations({ locale, namespace: "push.juz" });
    await pushToUser(userId, {
      title: t("title", { juz: highest.juz }),
      body: t("body"),
      url: "/app",
      /* One notification about juz at a time: a later one replaces the last
         rather than stacking a column of them in the tray. */
      tag: "juz",
    });
  } catch (error) {
    /* A milestone that could not be announced is still a milestone. It is
       written down, the seal is lit, and the celebration is waiting on the
       next screen they open — none of which depends on this. */
    console.error("[milestone] could not announce juz:", error);
  }
}
