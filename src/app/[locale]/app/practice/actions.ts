"use server";

import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { memorizationUnits, mistakes, reviewLogs } from "@/db/schema";
import { requireOnboardedUser } from "@/auth/guard";
import { TOTAL_PAGES } from "@/core/quran/mushaf";
import { decayedStrength, qualityFromDrill, review, type UnitState } from "@/core/srs/strength";
import { markDrill, missedRefs, type Answer } from "@/core/drill/grade";
import { DRILL_MODES } from "@/core/drill/types";
import { rebuildDrill } from "./session";
import type { PracticeState } from "./state";

/**
 * Recording a practice session.
 *
 * The drill is rebuilt from its seed rather than trusted from the browser, so
 * what is marked is what was actually asked. Everything the session produces —
 * the log, the new strength, the mistakes — is written in one transaction: a
 * strength that moved without a log to explain it would make the whole record
 * untrustworthy, and that record is the point of the product.
 */

const answerSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("reveal"),
    words: z.array(z.string().max(200)).max(64),
    hints: z.number().int().min(0).max(64).optional(),
  }),
  z.object({
    kind: z.literal("recall"),
    text: z.string().max(4000),
    hints: z.number().int().min(0).max(8).optional(),
  }),
  z.object({ kind: z.literal("choice"), choiceId: z.string().max(16).nullable() }),
  z.object({ kind: z.literal("order"), choiceIds: z.array(z.string().max(16)).max(16) }),
]);

const schema = z.object({
  page: z.coerce.number().int().min(1).max(TOTAL_PAGES),
  mode: z.enum(DRILL_MODES),
  level: z.coerce.number().min(0).max(1),
  nonce: z.string().max(64),
  durationSec: z.coerce.number().int().min(0).max(60 * 60 * 4),
  answers: z
    .string()
    .max(200_000)
    .transform((raw, ctx) => {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "answers must be JSON" });
        return z.NEVER;
      }
    })
    .pipe(z.array(answerSchema.nullable()).max(32)),
});

/** A page must be memorized before it can be practised. */
const NOT_HELD = "notHeld";

export async function submitDrill(
  _prev: PracticeState,
  formData: FormData,
): Promise<PracticeState> {
  const user = await requireOnboardedUser();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error" };

  const { page, mode, level, nonce, durationSec, answers } = parsed.data;

  try {
    const drill = await rebuildDrill({ userId: user.id, page, mode, level, nonce });
    if (!drill) return { status: "error" };

    const result = markDrill(drill.questions, answers as (Answer | null)[]);
    if (result.total === 0) return { status: "error" };

    const quality = qualityFromDrill({
      total: result.total,
      correct: result.correct,
      hints: result.hints,
    });

    const missed = missedRefs(drill.questions, result.marks);

    const outcome = await db.transaction(async (tx) => {
      const [unit] = await tx
        .select()
        .from(memorizationUnits)
        .where(and(eq(memorizationUnits.userId, user.id), eq(memorizationUnits.page, page)))
        .limit(1);

      /* Practising a page that is not held is not an error worth failing on,
         but it must not silently create a memorization record either — that
         would move the covenant's progress without anyone having memorized
         anything. */
      if (!unit) return NOT_HELD;

      const before: UnitState = {
        strength: unit.strength,
        ease: unit.ease,
        reps: unit.reps,
        lapses: unit.lapses,
        intervalDays: unit.intervalDays,
      };

      const days = unit.lastReviewedAt ? daysSince(unit.lastReviewedAt) : 0;
      const strengthBefore = decayedStrength(before, days);
      const after = review(before, quality, days);

      await tx
        .update(memorizationUnits)
        .set({
          strength: after.strength,
          ease: after.ease,
          reps: after.reps,
          lapses: after.lapses,
          intervalDays: after.intervalDays,
          lastReviewedAt: sql`now()`,
          nextDueAt: sql`now() + make_interval(days => ${Math.round(after.intervalDays)})`,
          updatedAt: sql`now()`,
        })
        .where(eq(memorizationUnits.id, unit.id));

      await tx.insert(reviewLogs).values({
        userId: user.id,
        unitId: unit.id,
        page,
        type: "test",
        quality,
        mistakeCount: result.total - result.correct,
        durationSec,
        strengthBefore,
        strengthAfter: after.strength,
      });

      if (missed.length > 0) {
        await tx.insert(mistakes).values(
          missed.slice(0, 32).map((ref) => ({
            userId: user.id,
            page,
            surah: ref.s,
            ayah: ref.a,
            wordIndex: ref.wordIndex,
            /* The duel is the one mode where being wrong means specifically
               that two passages were confused, which is worth distinguishing
               from having simply forgotten. */
            kind: mode === "mutashabihat" ? ("mutashabih" as const) : ("forgot" as const),
          })),
        );
      }

      return {
        quality,
        strengthBefore,
        strengthAfter: after.strength,
        lapsed: after.lapsed,
        needsRelearning: after.needsRelearning,
      };
    });

    if (outcome === NOT_HELD) {
      return { status: "notHeld" };
    }

    revalidatePath("/[locale]/app", "layout");

    return {
      status: "ok",
      total: result.total,
      correct: result.correct,
      hints: result.hints,
      wrongAt: result.marks.map((mark) => mark.wrongAt),
      ...outcome,
    };
  } catch (error) {
    console.error("[practice] could not record drill:", error);
    return { status: "error" };
  }
}

function daysSince(at: Date): number {
  return Math.max(0, Math.floor((Date.now() - at.getTime()) / 86_400_000));
}
