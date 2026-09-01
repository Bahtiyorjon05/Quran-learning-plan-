"use server";

import { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { mistakes } from "@/db/schema";
import { requireOnboardedUser } from "@/auth/guard";
import type { MarkState } from "@/core/plan/mark-state";

const schema = z.object({
  surah: z.coerce.number().int().min(1).max(114),
  ayah: z.coerce.number().int().min(1).max(286),
});

/**
 * Clearing a weak spot.
 *
 * Marked resolved rather than deleted: the row is evidence that this ayah was
 * once hard, and the admin's "hardest passages" report and any future study of
 * a reader's own history both rest on it. Resolving hides it from the list;
 * deleting would rewrite what happened.
 */
export async function resolveSpot(_prev: MarkState, formData: FormData): Promise<MarkState> {
  const user = await requireOnboardedUser();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error" };

  try {
    await db
      .update(mistakes)
      .set({ resolvedAt: sql`now()` })
      .where(
        and(
          eq(mistakes.userId, user.id),
          eq(mistakes.surah, parsed.data.surah),
          eq(mistakes.ayah, parsed.data.ayah),
          isNull(mistakes.resolvedAt),
        ),
      );
  } catch (error) {
    console.error("[mistakes] could not resolve:", error);
    return { status: "error" };
  }

  revalidatePath("/[locale]/app", "layout");
  return { status: "ok", memorized: true };
}
