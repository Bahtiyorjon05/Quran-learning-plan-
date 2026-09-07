"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { profiles, users } from "@/db/schema";
import { requireOnboardedUser } from "@/auth/guard";
import { RECITERS } from "@/lib/reciters";
import type { SettingsState } from "@/core/profile/settings-state";

/**
 * Everything on this screen is a preference, not a promise.
 *
 * Which is exactly why it is separate from the covenant: a name, an hour and
 * two switches can be changed as often as somebody likes, and nothing about
 * them touches what was agreed. The covenant has its own screen and its own
 * rules.
 */

const schema = z.object({
  displayName: z.string().trim().min(1).max(60),
  /* "05:30". The column is a `time`, and an empty string is a real answer —
     somebody who has not chosen an hour. */
  studyTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .or(z.literal(""))
    .optional(),
  reciter: z.enum(RECITERS.map((r) => r.id) as [string, ...string[]]),
  /* Offered as a list, so this is a sanity check rather than the gate. */
  timeZone: z.string().trim().min(1).max(64),
  reminders: z.string().optional(),
  weekly: z.string().optional(),
  sound: z.string().optional(),
});

export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireOnboardedUser();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error" };

  const { displayName, studyTime, reciter, timeZone, reminders, weekly, sound } = parsed.data;

  try {
    /* A time zone the runtime cannot resolve would silently move somebody's
       day boundary, which breaks their streak rather than their settings. */
    Intl.DateTimeFormat(undefined, { timeZone });
  } catch {
    return { status: "error" };
  }

  try {
    await db.transaction(async (tx) => {
      await tx.update(users).set({ displayName }).where(eq(users.id, user.id));
      await tx
        .update(profiles)
        .set({
          studyTime: studyTime ? studyTime : null,
          preferredReciter: reciter,
          timeZone,
          remindersEnabled: reminders === "on",
          weeklyEmail: weekly === "on",
          celebrationSound: sound === "on",
        })
        .where(eq(profiles.userId, user.id));
    });
  } catch (error) {
    console.error("[settings] could not save:", error);
    return { status: "error" };
  }

  /* The name is in the header of every signed-in page, and the time zone
     decides what "today" means, so the whole shell is stale after this. */
  revalidatePath("/[locale]/app", "layout");
  return { status: "saved" };
}

/**
 * Move the day boundary to where the reader now is.
 *
 * Called by the dashboard when the browser's zone no longer matches the stored
 * one — somebody has travelled. Deliberately not part of the settings form:
 * this is a fact being reported, not a preference being chosen, and it should
 * not wait for anybody to notice their streak breaking at 3am.
 */
export async function syncTimeZone(zone: string): Promise<void> {
  const user = await requireOnboardedUser();

  const wanted = zone.trim();
  if (!wanted || wanted.length > 64) return;

  /* Whatever the browser reports still has to be a zone this runtime knows,
     or every date computed from it afterwards is wrong. */
  try {
    Intl.DateTimeFormat(undefined, { timeZone: wanted });
  } catch {
    return;
  }

  const [profile] = await db
    .select({ timeZone: profiles.timeZone })
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);

  if (!profile || profile.timeZone === wanted) return;

  await db.update(profiles).set({ timeZone: wanted }).where(eq(profiles.userId, user.id));
  console.log(`[settings] ${user.id} moved from ${profile.timeZone} to ${wanted}`);

  revalidatePath("/[locale]/app", "layout");
}
