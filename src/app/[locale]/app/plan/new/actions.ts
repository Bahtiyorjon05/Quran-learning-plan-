"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";

import { db } from "@/db/client";
import { plans, profiles } from "@/db/schema";
import { requireOnboardedUser } from "@/auth/guard";
import { redirectTo } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { todayIn } from "@/core/date/civil";
import { TOTAL_JUZ } from "@/core/quran/mushaf";
import {
  MAX_DAILY_LINES,
  planFromDeadline,
  resolveScope,
  studyDaysPerWeek,
  type PlanScope,
} from "@/core/plan/schedule";
import type { NewPlanState } from "@/core/plan/wizard-state";

const schema = z.object({
  niyyah: z.string().trim().max(2000).optional().or(z.literal("")),
  scopeKind: z.enum(["full", "juzRange"]),
  fromJuz: z.coerce.number().int().min(1).max(TOTAL_JUZ),
  toJuz: z.coerce.number().int().min(1).max(TOTAL_JUZ),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  studyDaysMask: z.coerce.number().int().min(1).max(127),
  rukhsahBudget: z.coerce.number().int().min(0).max(24),
});

function fail(reason: keyof typeof REASONS): NewPlanState {
  return { status: "error", reason };
}

const REASONS = {
  alreadyActive: 1,
  invalidScope: 1,
  invalidDates: 1,
  noStudyDays: 1,
  tooFast: 1,
  unknown: 1,
} as const;

export async function createCovenant(
  _prev: NewPlanState,
  formData: FormData,
): Promise<NewPlanState> {
  const user = await requireOnboardedUser();
  const locale = (await getLocale()) as Locale;

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("invalidScope");

  const input = parsed.data;

  /* One live covenant at a time. The database enforces this with a partial
     unique index; checking here turns a constraint violation into a sentence. */
  const [existing] = await db
    .select({ id: plans.id })
    .from(plans)
    .where(and(eq(plans.userId, user.id), eq(plans.status, "active")))
    .limit(1);
  if (existing) return fail("alreadyActive");

  const scope: PlanScope =
    input.scopeKind === "full"
      ? { kind: "full" }
      : { kind: "juzRange", fromJuz: input.fromJuz, toJuz: input.toJuz };

  if (input.scopeKind === "juzRange" && input.fromJuz > input.toJuz) {
    return fail("invalidScope");
  }
  if (studyDaysPerWeek(input.studyDaysMask) === 0) return fail("noStudyDays");

  /* The student's own timezone decides what "today" is. A covenant signed at
     23:30 in Tashkent must not start yesterday because the server is in UTC. */
  const [profile] = await db
    .select({ timeZone: profiles.timeZone })
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);
  const startDate = todayIn(profile?.timeZone ?? "Asia/Tashkent");

  /* Recomputed here, never taken from the form. The client does the same maths
     to render a preview, but a covenant is not something to accept on trust
     from a browser. */
  let shape;
  try {
    shape = planFromDeadline({
      scope,
      startDate,
      endDate: input.endDate,
      studyDaysMask: input.studyDaysMask,
    });
  } catch {
    return fail("invalidDates");
  }

  if (shape.dailyLines > MAX_DAILY_LINES) return fail("tooFast");

  const resolved = resolveScope(scope);

  try {
    await db.insert(plans).values({
      userId: user.id,
      scope: input.scopeKind === "full" ? "full" : "juz_range",
      scopeFromPage: resolved.fromPage,
      scopeToPage: resolved.toPage,
      totalLines: shape.totalLines,
      niyyah: input.niyyah?.trim() || null,
      startDate: shape.startDate,
      /* Equal at signing — the insert trigger insists on it, and the covenant
         only means something because these two can drift apart in one
         direction afterwards. */
      originalEndDate: shape.endDate,
      currentEndDate: shape.endDate,
      studyDaysMask: input.studyDaysMask,
      rukhsahBudget: input.rukhsahBudget,
    });
  } catch (error) {
    console.error("[plan] could not create covenant:", error);
    return fail("unknown");
  }

  return redirectTo("/app", locale);
}
