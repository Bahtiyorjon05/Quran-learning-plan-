"use server";

import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { memorizationUnits } from "@/db/schema";
import { requireOnboardedUser } from "@/auth/guard";
import { TOTAL_PAGES } from "@/core/quran/mushaf";
import type { MarkState } from "@/core/plan/mark-state";
/* One definition of "how far through the covenant", not two. This file used
   to keep its own, which counted every memorized page anywhere in scope while
   today's counted the unbroken run from its start — so the same reader saw 2%
   or 4% depending only on which of the two had written last. */
import { recomputeProgress } from "@/app/[locale]/app/today";

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

    await recomputeProgress(user.id);
  } catch (error) {
    console.error("[quran] could not mark page:", error);
    return { status: "error" };
  }

  revalidatePath("/[locale]/app", "layout");
  return { status: "ok", memorized };
}


