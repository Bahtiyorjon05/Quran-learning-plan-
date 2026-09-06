import "server-only";

import webpush from "web-push";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";

/**
 * Sending a notification to a person's devices.
 *
 * Push is not email. There is no queue to retry from, no bounce address, and
 * the payload is encrypted to a key that only that one browser holds — so a
 * message either lands within seconds or is gone. That shapes everything here:
 *
 *   · Every device gets its own attempt, and one failing says nothing about
 *     the others. A phone left in a drawer for a month is not a reason to skip
 *     the laptop.
 *
 *   · 404 and 410 are the push service saying the browser threw this
 *     subscription away — reinstalled, cleared, permission revoked. That is
 *     not an error to retry; the row is deleted, because keeping it means
 *     sending into the dark forever.
 *
 *   · Nothing here ever throws. A reminder failing to send must not take down
 *     the cron run that was also going to send forty others.
 */

let configured = false;

/** Lazy, because a build without keys must still build. */
function ready(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? "mailto:hello@ahd.uz",
      publicKey,
      privateKey,
    );
    configured = true;
  }
  return true;
}

export type PushMessage = {
  title: string;
  body: string;
  /** Where tapping it should land. Relative to the origin. */
  url?: string;
  /** Collapses older notifications of the same kind rather than stacking. */
  tag?: string;
};

/**
 * Deliver to every device a person has, and report how many took it.
 *
 * Dead subscriptions are cleaned up as a side effect, which is the only
 * housekeeping this table ever needs.
 */
export async function pushToUser(userId: string, message: PushMessage): Promise<number> {
  if (!ready()) return 0;

  const devices = await db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), isNull(pushSubscriptions.failedAt)));

  if (devices.length === 0) return 0;

  const payload = JSON.stringify(message);
  const dead: string[] = [];
  let delivered = 0;

  await Promise.all(
    devices.map(async (device) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: device.endpoint,
            keys: { p256dh: device.p256dh, auth: device.auth },
          },
          payload,
          { TTL: 60 * 60 * 6 },
        );
        delivered += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        /* Gone for good, as opposed to merely unlucky. */
        if (status === 404 || status === 410) dead.push(device.id);
        else {
          console.error("[push] could not deliver:", status ?? error);
        }
      }
    }),
  );

  if (dead.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead));
  }

  return delivered;
}

/** Whether this account has anywhere to be notified. */
export async function hasPushDevices(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), isNull(pushSubscriptions.failedAt)))
    .limit(1);
  return Boolean(row);
}
