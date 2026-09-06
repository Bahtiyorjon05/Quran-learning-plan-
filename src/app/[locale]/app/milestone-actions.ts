"use server";

import { requireOnboardedUser } from "@/auth/guard";
import { markJuzSeen } from "@/core/milestones/juz";

/** The celebration has been shown. Written on the way out, not the way in. */
export async function markJuzSeenAction(juz: number[]): Promise<void> {
  const user = await requireOnboardedUser();
  const clean = juz.filter((n) => Number.isInteger(n) && n >= 1 && n <= 30);
  await markJuzSeen(user.id, clean);
}
