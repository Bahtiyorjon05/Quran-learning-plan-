"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, count, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { planAmendments, plans, profiles } from "@/db/schema";
import { requireOnboardedUser } from "@/auth/guard";
import { todayIn, compare, type CivilDate } from "@/core/date/civil";
import type { AmendState } from "@/core/plan/amend-state";

/**
 * Bringing a deadline closer.
 *
 * The one amendment a covenant allows, and it only ever moves one way. The
 * database enforces that with a trigger and would refuse an extension however
 * this action were written; the checks here exist so somebody is told *why* in
 * their own language rather than being handed a constraint violation.
 *
 * Nothing is written to plan_amendments from here. An AFTER UPDATE trigger
 * logs the shortening itself, and writing a second row would be a lie about
 * how many times the covenant had been changed — including to this action's
 * own "have you already used it" check.
 */

const fail = (reason: "later" | "past" | "spent" | "failed"): AmendState => ({
  status: "error",
  reason,
});

const schema = z.object({
  newEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** How many times this covenant has been shortened. One is the limit. */
export async function timesShortened(planId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(planAmendments)
    .where(and(eq(planAmendments.planId, planId), eq(planAmendments.kind, "shortened")));
  return row?.n ?? 0;
}

export async function amendDeadline(
  _prev: AmendState,
  formData: FormData,
): Promise<AmendState> {
  const user = await requireOnboardedUser();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("failed");
  const next = parsed.data.newEndDate as CivilDate;

  const [plan] = await db
    .select({
      id: plans.id,
      startDate: plans.startDate,
      currentEndDate: plans.currentEndDate,
    })
    .from(plans)
    .where(and(eq(plans.userId, user.id), eq(plans.status, "active")))
    .limit(1);
  if (!plan) return fail("failed");

  if ((await timesShortened(plan.id)) >= 1) return fail("spent");

  /* Strictly nearer. Equal is not an amendment, and later is the thing the
     covenant exists to refuse. */
  if (compare(next, plan.currentEndDate as CivilDate) >= 0) return fail("later");

  const [profile] = await db
    .select({ timeZone: profiles.timeZone })
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);

  const today = todayIn(profile?.timeZone ?? "Asia/Tashkent");
  if (compare(next, today) <= 0) return fail("past");
  if (compare(next, plan.startDate as CivilDate) < 0) return fail("past");

  try {
    await db
      .update(plans)
      .set({ currentEndDate: next })
      .where(eq(plans.id, plan.id));
  } catch (error) {
    /* The trigger is the real gate. If it refuses, something above was wrong. */
    console.error("[amend] the covenant refused the change:", error);
    return fail("failed");
  }

  revalidatePath("/[locale]/app", "layout");
  return { status: "done" };
}
