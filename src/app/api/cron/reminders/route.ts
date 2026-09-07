import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { plans, profiles, pushSubscriptions, users } from "@/db/schema";
import { pushToUser } from "@/push/send";
import { timingSafeEqual } from "node:crypto";

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

  const offered = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  /* Compared byte for byte in constant time. `===` on a secret returns as soon
     as two bytes differ, and the difference is measurable over enough
     requests. */
  const a = Buffer.from(offered);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  /* Everyone whose chosen hour has come round today and who has not been sent
     today's reminder yet — in their own zone, in SQL, so one query covers
     every zone at once.
     
     Deliberately "the time has passed and nothing has gone out today" rather
     than "the current hour equals the chosen hour". The hourly pass is a
     GitHub Actions schedule, and GitHub drops runs under load: the real
     spacing in production was closer to two hours, so an exact-hour match
     silently skipped every reader whose hour fell in a dropped run while the
     endpoint went on answering 200. Now a late pass still catches them, and
     the date stamp stops a second pass sending it twice. */
  const due = await db
    .selectDistinct({
      id: users.id,
      locale: profiles.locale,
      localDate: sql<string>`(now() at time zone ${profiles.timeZone})::date`.as("local_date"),
    })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .innerJoin(plans, and(eq(plans.userId, users.id), eq(plans.status, "active")))
    .innerJoin(pushSubscriptions, eq(pushSubscriptions.userId, users.id))
    .where(
      and(
        eq(profiles.remindersEnabled, true),
        isNotNull(profiles.studyTime),
        sql`(now() at time zone ${profiles.timeZone})::time >= ${profiles.studyTime}`,
        sql`(${profiles.remindedOn} is null or ${profiles.remindedOn} < (now() at time zone ${profiles.timeZone})::date)`,
      ),
    );

  let delivered = 0;

  /* In batches rather than one at a time. Each send is a round trip to a push
     service, and a few thousand of them in series is a function that times out
     halfway down the list — leaving the tail of the alphabet reminded only on
     the days the run happened to be quick. */
  const BATCH = 20;
  for (let i = 0; i < due.length; i += BATCH) {
    const batch = due.slice(i, i + BATCH);

    const counts = await Promise.all(
      batch.map((person) => {
        const locale = (person.locale ?? "uz") as Locale;
        const copy = MESSAGES[locale].push.daily;
        return pushToUser(person.id, {
          title: copy.title,
          body: copy.body,
          url: "/app",
          /* One reminder replaces yesterday's rather than stacking beneath it. */
          tag: "ahd-daily",
        }).catch(() => 0);
      }),
    );
    delivered += counts.reduce((sum, n) => sum + n, 0);

    /* Stamped whatever the push service said. A failed delivery that is retried
       every hour for the rest of the day is worse than a reminder missed: the
       reader either has a working subscription tomorrow or they do not. */
    await db
      .update(profiles)
      .set({ remindedOn: sql`(now() at time zone ${profiles.timeZone})::date` })
      .where(inArray(profiles.userId, batch.map((person) => person.id)));
  }

  return Response.json({ ok: true, considered: due.length, delivered });
}
