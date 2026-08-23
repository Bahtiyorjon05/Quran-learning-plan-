import "server-only";

import { and, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { memorizationUnits, planDays, plans, profiles } from "@/db/schema";
import { todayIn, type CivilDate } from "@/core/date/civil";
import { LINES_PER_PAGE } from "@/core/quran/mushaf";
import { buildDailySheet, type DailySheet, type MemorizedPage } from "@/core/plan/daily";
import { computePace, type Pace } from "@/core/plan/pace";
import { countStudyDays, isStudyDay, type PlanScope } from "@/core/plan/schedule";

/**
 * Everything today's sheet needs, assembled once.
 *
 * Shared by the page and by the actions that mark a track done, so both see the
 * same day. The sheet is derived from state rather than written on every visit
 * — a page load should not be a database write — and is frozen into plan_days
 * only when the first track is ticked.
 */

export type Today = {
  plan: {
    id: string;
    scope: PlanScope;
    scopeFromPage: number;
    totalLines: number;
    completedLines: number;
    dailyLines: number;
    startDate: CivilDate;
    currentEndDate: CivilDate;
    studyDaysMask: number;
    manzilCycle: "adaptive" | "classic";
    niyyah: string | null;
  };
  date: CivilDate;
  isStudyDay: boolean;
  sheet: DailySheet;
  done: { sabaq: boolean; sabqi: boolean; manzil: boolean };
  pace: Pace;
  streak: number;
};

export async function loadToday(userId: string): Promise<Today | null> {
  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.userId, userId), eq(plans.status, "active")))
    .limit(1);
  if (!plan) return null;

  const [profile] = await db
    .select({ timeZone: profiles.timeZone, streak: profiles.currentStreak })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  const date = todayIn(profile?.timeZone ?? "Asia/Tashkent");

  const units = await db
    .select({
      page: memorizationUnits.page,
      strength: memorizationUnits.strength,
      firstMemorizedAt: memorizationUnits.firstMemorizedAt,
      lastReviewedAt: memorizationUnits.lastReviewedAt,
    })
    .from(memorizationUnits)
    .where(and(eq(memorizationUnits.userId, userId), eq(memorizationUnits.state, "memorized")));

  const memorized: MemorizedPage[] = units.map((u) => ({
    page: u.page,
    strength: u.strength,
    firstMemorizedAt: toCivil(u.firstMemorizedAt) ?? date,
    lastReviewedAt: toCivil(u.lastReviewedAt),
  }));

  const scope: PlanScope =
    plan.scope === "full"
      ? { kind: "full" }
      : { kind: "pageRange", fromPage: plan.scopeFromPage, toPage: plan.scopeToPage };

  /* The portion agreed at signing, recovered from the original deadline. Pace
     is measured against it, so it must not drift when the deadline is pulled
     closer. */
  const originalDailyLines = Math.max(
    1,
    Math.ceil(
      plan.totalLines /
        Math.max(1, countStudyDays(plan.startDate, plan.originalEndDate, plan.studyDaysMask)),
    ),
  );

  /* What today asks for, at the pace the covenant currently requires. */
  const pace = computePace({
    totalLines: plan.totalLines,
    completedLines: plan.completedLines,
    originalDailyLines,
    today: date,
    endDate: plan.currentEndDate,
    studyDaysMask: plan.studyDaysMask,
  });

  const [existing] = await db
    .select()
    .from(planDays)
    .where(and(eq(planDays.planId, plan.id), eq(planDays.date, date)))
    .limit(1);

  const sheet: DailySheet = existing?.sabaqFromLine
    ? {
        sabaq: { fromLine: existing.sabaqFromLine, toLine: existing.sabaqToLine! },
        sabqi: existing.sabqiPages ?? [],
        manzil: existing.manzilPages ?? [],
      }
    : buildDailySheet({
        scope,
        startDate: plan.startDate,
        today: date,
        completedLines: plan.completedLines,
        dailyLines: Math.max(1, pace.requiredDailyLines),
        memorized,
        manzilCycle: plan.manzilCycle,
      });

  return {
    plan: {
      id: plan.id,
      scope,
      scopeFromPage: plan.scopeFromPage,
      totalLines: plan.totalLines,
      completedLines: plan.completedLines,
      dailyLines: Math.max(1, pace.requiredDailyLines),
      startDate: plan.startDate,
      currentEndDate: plan.currentEndDate,
      studyDaysMask: plan.studyDaysMask,
      manzilCycle: plan.manzilCycle,
      niyyah: plan.niyyah,
    },
    date,
    isStudyDay: isStudyDay(date, plan.studyDaysMask),
    sheet,
    done: {
      sabaq: Boolean(existing?.sabaqDone),
      sabqi: Boolean(existing?.sabqiDone),
      manzil: Boolean(existing?.manzilDone),
    },
    pace,
    streak: profile?.streak ?? 0,
  };
}

function toCivil(value: Date | null): CivilDate | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

/**
 * How far through the scope the covenant has actually come.
 *
 * Two things can move it and they disagree in an interesting way, so it is
 * derived from both rather than incremented by either:
 *
 *   · completed sabaq, which advances by exact lines — a nine-line portion does
 *     not finish a fifteen-line page, and crediting a whole page for it would
 *     finish the Qur'an in 604 days instead of the 1,096 someone signed for;
 *   · pages marked memorized in the reader, which only count from the start of
 *     the scope in an unbroken run. Someone memorizing juz 30 first is holding
 *     real pages — the mosaic and the revision tracks show them — but they have
 *     not advanced *through* the scope, and the covenant measures the journey.
 *
 * Taking the larger of the two lets either route move it, and lets unmarking a
 * page regress it no further than the sabaq that was genuinely completed.
 */
export async function recomputeProgress(userId: string) {
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

  const [frontier] = await db
    .select({ furthest: sql<number | null>`max(${planDays.sabaqToLine})` })
    .from(planDays)
    .where(and(eq(planDays.planId, plan.id), isNotNull(planDays.sabaqDone)));

  const scopeFirstLine = (plan.fromPage - 1) * LINES_PER_PAGE + 1;
  const fromSabaq = frontier?.furthest ? frontier.furthest - scopeFirstLine + 1 : 0;

  const held = await db
    .select({ page: memorizationUnits.page })
    .from(memorizationUnits)
    .where(and(eq(memorizationUnits.userId, userId), eq(memorizationUnits.state, "memorized")));

  const pages = new Set(held.map((h) => h.page));
  let run = 0;
  for (let page = plan.fromPage; page <= plan.toPage && pages.has(page); page++) run++;

  const completed = Math.min(plan.totalLines, Math.max(0, fromSabaq, run * LINES_PER_PAGE));
  await db.update(plans).set({ completedLines: completed }).where(eq(plans.id, plan.id));
}
