"use server";

import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { memorizationUnits } from "@/db/schema";
import { requireOnboardedUser } from "@/auth/guard";
import { TOTAL_PAGES } from "@/core/quran/mushaf";
import { pageMeta } from "@/data/quran/loader";
import type { MarkState } from "@/core/plan/mark-state";
/* One definition of "how far through the covenant", not two. This file used
   to keep its own, which counted every memorized page anywhere in scope while
   today's counted the unbroken run from its start — so the same reader saw 2%
   or 4% depending only on which of the two had written last. */
import { recomputeProgress } from "@/app/[locale]/app/today";

const schema = z.object({
  page: z.coerce.number().int().min(1).max(TOTAL_PAGES),
  memorized: z.enum(["true", "false"]),
  /* Which surah on the page is being claimed. Absent means the whole page,
     which is what it always meant and what nearly every page is. */
  surah: z.coerce.number().int().min(1).max(114).optional(),
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

  const { page, surah } = parsed.data;
  const memorized = parsed.data.memorized === "true";

  /* A page carrying several short surahs cannot be claimed as one thing.
     Somebody who has Al-Kawthar by heart should be able to say so without also
     claiming Al-Ma'un and Al-Kafirun, which sit on the page with it. */
  const onPage = pageMeta(page).surahs;
  if (surah !== undefined && !onPage.includes(surah)) return { status: "error" };

  try {
    if (surah !== undefined && onPage.length > 1) {
      const held = await heldSurahs(user.id, page, onPage);
      const next = memorized
        ? [...new Set([...held, surah])].sort((a, b) => a - b)
        : held.filter((n) => n !== surah);

      if (next.length === 0) {
        await db
          .delete(memorizationUnits)
          .where(and(eq(memorizationUnits.userId, user.id), eq(memorizationUnits.page, page)));
      } else {
        /* Whole again once the last surah on the page is marked: `surahs` goes
           back to null and the page rejoins the revision rotation. */
        const whole = next.length === onPage.length;
        await db
          .insert(memorizationUnits)
          .values({
            userId: user.id,
            page,
            surahs: whole ? null : next,
            state: "memorized",
            strength: INITIAL_STRENGTH,
            reps: 1,
            firstMemorizedAt: sql`now()`,
            lastReviewedAt: sql`now()`,
          })
          .onConflictDoUpdate({
            target: [memorizationUnits.userId, memorizationUnits.page],
            set: {
              surahs: whole ? null : next,
              state: "memorized",
              lastReviewedAt: sql`now()`,
              firstMemorizedAt: sql`coalesce(${memorizationUnits.firstMemorizedAt}, now())`,
            },
          });
      }

      await recomputeProgress(user.id);
      revalidatePath("/[locale]/app", "layout");
      return { status: "ok", memorized };
    }

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



/**
 * The surahs of this page the reader already holds.
 *
 * A row with a null `surahs` is the whole page, so every surah on it counts —
 * which is what makes unmarking one of them from a previously whole page work
 * rather than wiping the lot.
 */
async function heldSurahs(userId: string, page: number, onPage: number[]): Promise<number[]> {
  const [row] = await db
    .select({ surahs: memorizationUnits.surahs, state: memorizationUnits.state })
    .from(memorizationUnits)
    .where(and(eq(memorizationUnits.userId, userId), eq(memorizationUnits.page, page)))
    .limit(1);

  if (!row || row.state !== "memorized") return [];
  return row.surahs ?? [...onPage];
}
