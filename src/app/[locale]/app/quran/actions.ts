"use server";

import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { memorizationUnits, plans } from "@/db/schema";
import { requireOnboardedUser } from "@/auth/guard";
import { LINES_PER_PAGE, TOTAL_PAGES } from "@/core/quran/mushaf";
import type { MarkState } from "@/core/plan/mark-state";

const schema = z.object({
  page: z.coerce.number().int().min(1).max(TOTAL_PAGES),
  memorized: z.enum(["true", "false"]),
});

/**
 * A page marked memorized starts at a middling strength, not a full one.
 *
 * Having just committed something to memory is not the same as holding it
 * securely — that is the whole premise of the revision tracks. Strength climbs
 * from here with clean recitation and decays without it.
 */
const INITIAL_STRENGTH = 50;

export async function setPageMemorized(
  _prev: MarkState,
  formData: FormData,
): Promise<MarkState> {
  const user = await requireOnboardedUser();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error" };

  const { page } = parsed.data;
  const memorized = parsed.data.memorized === "true";

  try {
    if (memorized) {
      await db
        .insert(memorizationUnits)
        .values({
          userId: user.id,
          page,
          state: "memorized",
          strength: INITIAL_STRENGTH,
          reps: 1,
          firstMemorizedAt: sql`now()`,
          lastReviewedAt: sql`now()`,
        })
        .onConflictDoUpdate({
          target: [memorizationUnits.userId, memorizationUnits.page],
          set: {
            state: "memorized",
            strength: INITIAL_STRENGTH,
            lastReviewedAt: sql`now()`,
            /* Preserved: the first time something was memorized is a fact about
               a person's history, not a field to overwrite on a re-mark. */
            firstMemorizedAt: sql`coalesce(${memorizationUnits.firstMemorizedAt}, now())`,
          },
        });
    } else {
      await db
        .delete(memorizationUnits)
        .where(and(eq(memorizationUnits.userId, user.id), eq(memorizationUnits.page, page)));
    }

    await recomputePlanProgress(user.id);
  } catch (error) {
    console.error("[quran] could not mark page:", error);
    return { status: "error" };
  }

  revalidatePath("/[locale]/app", "layout");
  return { status: "ok", memorized };
}

/**
 * Keeps the covenant's progress in step with what has actually been memorized.
 *
 * Marking a page is the only way completed_lines moves, and it is recomputed
 * from the units rather than incremented — an increment drifts the moment
 * anything is marked twice or unmarked, and the pace gauge is the number people
 * trust most.
 */
async function recomputePlanProgress(userId: string) {
  const [plan] = await db
    .select({
      id: plans.id,
      fromPage: plans.scopeFromPage,
      toPage: plans.scopeToPage,
      totalLines: plans.totalLines,
    })
    .from(plans)
    .where(and(eq(plans.userId, userId), eq(plans.status, "active")))
    .limit(1);

  if (!plan) return;

  const [row] = await db
    .select({ pages: sql<number>`count(*)::int` })
    .from(memorizationUnits)
    .where(
      and(
        eq(memorizationUnits.userId, userId),
        eq(memorizationUnits.state, "memorized"),
        sql`${memorizationUnits.page} between ${plan.fromPage} and ${plan.toPage}`,
      ),
    );

  const completed = Math.min((row?.pages ?? 0) * LINES_PER_PAGE, plan.totalLines);
  await db.update(plans).set({ completedLines: completed }).where(eq(plans.id, plan.id));
}
