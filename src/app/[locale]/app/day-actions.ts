"use server";

import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { memorizationUnits, planDays, profiles } from "@/db/schema";
import { requireOnboardedUser } from "@/auth/guard";
import { addDays } from "@/core/date/civil";
import { LINES_PER_PAGE } from "@/core/quran/mushaf";
import type { MarkState } from "@/core/plan/mark-state";
import { loadToday, recomputeProgress } from "./today";

const schema = z.object({
  track: z.enum(["sabaq", "sabqi", "manzil"]),
  done: z.enum(["true", "false"]),
});

/** Freshly memorized pages start mid-strength; revised ones climb. */
const NEW_STRENGTH = 50;
const REVISION_GAIN = 12;
const MAX_STRENGTH = 100;

export async function markTrack(_prev: MarkState, formData: FormData): Promise<MarkState> {
  const user = await requireOnboardedUser();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error" };

  const { track } = parsed.data;
  const done = parsed.data.done === "true";

  const today = await loadToday(user.id);
  if (!today) return { status: "error" };

  try {
    /* The day is frozen the moment it is first touched. Until then the sheet is
       derived, so an untouched day costs no writes; afterwards it must stop
       moving, or ticking sabaq would change what sabaq was. */
    await db
      .insert(planDays)
      .values({
        planId: today.plan.id,
        date: today.date,
        sabaqFromLine: today.sheet.sabaq?.fromLine ?? null,
        sabaqToLine: today.sheet.sabaq?.toLine ?? null,
        sabqiPages: today.sheet.sabqi,
        manzilPages: today.sheet.manzil,
        [`${track}Done`]: done ? sql`now()` : null,
      })
      .onConflictDoUpdate({
        target: [planDays.planId, planDays.date],
        set: { [`${track}Done`]: done ? sql`now()` : null },
      });

    if (done && track === "sabaq" && today.sheet.sabaq) {
      await recordNewMemorization(user.id, today.sheet.sabaq.toLine, today.plan.scopeFromPage);
    }
    if (done && track !== "sabaq") {
      const pages = track === "sabqi" ? today.sheet.sabqi : today.sheet.manzil;
      await recordRevision(user.id, pages);
    }

    await recomputeProgress(user.id);
    await updateStreak(user.id, today.plan.id, today.date);
  } catch (error) {
    console.error("[today] could not mark track:", error);
    return { status: "error" };
  }

  revalidatePath("/[locale]/app", "layout");
  return { status: "ok", memorized: done };
}

/**
 * A page becomes memorized only once the frontier has passed its final line.
 *
 * Nine lines a day does not finish a fifteen-line page, and marking one anyway
 * would credit half a page of work as a whole one — and, compounded, finish the
 * Qur'an in 604 days rather than the 1,096 the covenant was signed for.
 */
async function recordNewMemorization(userId: string, frontierLine: number, scopeFromPage: number) {
  const lastCompletePage = Math.floor(frontierLine / LINES_PER_PAGE);
  if (lastCompletePage < scopeFromPage) return;

  for (let page = scopeFromPage; page <= lastCompletePage; page++) {
    await db
      .insert(memorizationUnits)
      .values({
        userId,
        page,
        state: "memorized",
        strength: NEW_STRENGTH,
        reps: 1,
        firstMemorizedAt: sql`now()`,
        lastReviewedAt: sql`now()`,
      })
      .onConflictDoNothing({
        target: [memorizationUnits.userId, memorizationUnits.page],
      });
  }
}

/** Reciting a page cleanly strengthens it and resets its clock. */
async function recordRevision(userId: string, pages: number[]) {
  if (pages.length === 0) return;

  await db
    .update(memorizationUnits)
    .set({
      strength: sql`least(${MAX_STRENGTH}, ${memorizationUnits.strength} + ${REVISION_GAIN})`,
      reps: sql`${memorizationUnits.reps} + 1`,
      lastReviewedAt: sql`now()`,
    })
    .where(
      and(
        eq(memorizationUnits.userId, userId),
        sql`${memorizationUnits.page} = any(${sql.raw(`ARRAY[${pages.join(",")}]::smallint[]`)})`,
      ),
    );
}

/**
 * A day counts only when every obligation it set is met.
 *
 * A day with nothing to revise is complete on sabaq alone; a finished scope is
 * complete on revision alone. Requiring three ticks regardless would make the
 * streak unreachable for the people at both ends.
 */
async function updateStreak(userId: string, planId: string, date: string) {
  const [day] = await db
    .select()
    .from(planDays)
    .where(and(eq(planDays.planId, planId), eq(planDays.date, date)))
    .limit(1);
  if (!day) return;

  const required = [
    day.sabaqFromLine !== null ? Boolean(day.sabaqDone) : true,
    (day.sabqiPages?.length ?? 0) > 0 ? Boolean(day.sabqiDone) : true,
    (day.manzilPages?.length ?? 0) > 0 ? Boolean(day.manzilDone) : true,
  ];
  const complete = required.every(Boolean);

  await db
    .update(planDays)
    .set({
      status: complete ? "complete" : "partial",
      completedAt: complete ? sql`now()` : null,
    })
    .where(eq(planDays.id, day.id));

  if (!complete) return;

  const [profile] = await db
    .select({
      current: profiles.currentStreak,
      longest: profiles.longestStreak,
      last: profiles.lastCompleteDate,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!profile) return;

  const last = profile.last ? String(profile.last).slice(0, 10) : null;
  if (last === date) return; // already counted today

  const next = last === addDays(date, -1) ? profile.current + 1 : 1;

  await db
    .update(profiles)
    .set({
      currentStreak: next,
      longestStreak: Math.max(profile.longest, next),
      lastCompleteDate: date,
    })
    .where(eq(profiles.userId, userId));
}
