import { and, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { plans, profiles, pushSubscriptions, users } from "@/db/schema";
import { pushToUser } from "@/push/send";
import { env } from "@/lib/env";
import en from "../../../../../messages/en.json";
import ru from "../../../../../messages/ru.json";
import uz from "../../../../../messages/uz.json";
import type { Locale } from "@/i18n/routing";

/* The copy, straight from the message files: a push has no request scope to
   hang a translator off, and this runs from a cron with no request at all. */
const MESSAGES = { en, ru, uz } as const;

/**
 * The daily reminder, sent at the hour each person chose.
 *
 * Runs every hour rather than once a day, because "05:30" means 05:30 *where
 * they are* — and this app already has readers in Tashkent and Seoul, four
 * hours apart. Each run asks Postgres which accounts are currently inside
 * their chosen hour in their own zone, which is one query rather than a loop
 * over every timezone in the world.
 *
 * Nobody is written to twice: an account whose local hour matches is sent to
 * once, and the next matching hour is a day away.
 *
 * Only accounts with a covenant, a live push subscription and the reminder
 * switched on are considered. Everything else is silence, which is the correct
 * default for a message nobody asked for that morning.
 */

function authorised(request: Request): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  /* The hour, in each person's own zone, compared with the hour they chose.
     Done in SQL so one query covers every zone at once. */
  const due = await db
    .selectDistinct({
      id: users.id,
      locale: profiles.locale,
    })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .innerJoin(plans, and(eq(plans.userId, users.id), eq(plans.status, "active")))
    .innerJoin(pushSubscriptions, eq(pushSubscriptions.userId, users.id))
    .where(
      and(
        eq(profiles.remindersEnabled, true),
        isNotNull(profiles.studyTime),
        sql`date_part('hour', (now() at time zone ${profiles.timeZone})) = date_part('hour', ${profiles.studyTime})`,
      ),
    );

  let delivered = 0;

  for (const person of due) {
    const locale = (person.locale ?? "uz") as Locale;
    const copy = MESSAGES[locale].push.daily;
    delivered += await pushToUser(person.id, {
      title: copy.title,
      body: copy.body,
      url: "/app",
      /* One reminder replaces yesterday's rather than stacking beneath it. */
      tag: "ahd-daily",
    });
  }

  return Response.json({ ok: true, considered: due.length, delivered });
}
