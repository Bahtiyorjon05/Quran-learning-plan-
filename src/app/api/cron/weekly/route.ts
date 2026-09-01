import { and, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { memorizationUnits, plans, profiles, users } from "@/db/schema";
import { todayIn } from "@/core/date/civil";
import { computePace } from "@/core/plan/pace";
import { countStudyDays } from "@/core/plan/schedule";
import { decayedStrength, FRAGILE_BELOW, type UnitState } from "@/core/srs/strength";
import { weeklyReportEmail, type WeeklyFigures } from "@/email/templates";
import { sendMail } from "@/email/mailer";
import { env } from "@/lib/env";
import type { Locale } from "@/i18n/routing";

/**
 * The weekly report, sent Monday morning.
 *
 * The only message Ahd sends that nobody asked for, so it earns the
 * interruption or it should not exist. Two rules keep it honest:
 *
 *   Nobody who has nothing to report is written to. An account that never
 *   finished onboarding, or holds no pages, gets silence rather than a
 *   cheerful empty summary — the surest way to teach someone to filter you.
 *
 *   The figures are the same ones the dashboard shows, computed by the same
 *   functions. A report that disagreed with the screen it describes would be
 *   worse than no report.
 *
 * Vercel calls this on a schedule and sends its own bearer token. Anyone else
 * gets 401: the route can send mail to every address in the database, so it is
 * not something to leave open.
 */

export const dynamic = "force-dynamic";
/* Sending is sequential and deliberate; a hundred accounts must not time out. */
export const maxDuration = 300;

function authorised(request: Request): boolean {
  const secret = env.CRON_SECRET;
  /* No secret configured means this cannot be called at all, rather than
     meaning it is open. */
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const recipients = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.displayName,
      locale: profiles.locale,
      timeZone: profiles.timeZone,
      streak: profiles.currentStreak,
      weeklyEmail: profiles.weeklyEmail,
    })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(
      and(
        isNotNull(users.emailVerifiedAt),
        isNotNull(profiles.onboardedAt),
        eq(profiles.weeklyEmail, true),
      ),
    );

  let sent = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const person of recipients) {
    try {
      const figures = await weekFor(person.id, person.timeZone, person.streak);

      /* Nothing happened and nothing is held: there is no report to make. */
      if (figures.held === 0 && figures.memorized === 0 && figures.drills === 0) {
        skipped++;
        continue;
      }

      const mail = await weeklyReportEmail(
        person.locale as Locale,
        person.email,
        person.name ?? "",
        figures,
      );
      await sendMail(mail);
      sent++;
    } catch (error) {
      /* One bad address must not stop the other ninety-nine. */
      failures.push(`${person.email}: ${(error as Error).message}`);
    }
  }

  if (failures.length > 0) console.error("[cron/weekly] failures:", failures);

  return Response.json({
    ok: true,
    considered: recipients.length,
    sent,
    skipped,
    failed: failures.length,
  });
}

/** Everything one person's report needs, from the same code the app uses. */
async function weekFor(
  userId: string,
  timeZone: string,
  streak: number,
): Promise<WeeklyFigures> {
  const [counts] = await db.execute<{
    memorized: number;
    drills: number;
    held: number;
  }>(sql`
    select
      (select count(*) from memorization_units
        where user_id = ${userId} and state = 'memorized'
          and first_memorized_at > now() - interval '7 days')::int as memorized,
      (select count(*) from review_logs
        where user_id = ${userId} and created_at > now() - interval '7 days')::int as drills,
      (select count(*) from memorization_units
        where user_id = ${userId} and state = 'memorized')::int as held
  `).then((result) => result.rows as { memorized: number; drills: number; held: number }[]);

  /* Fragile is computed rather than stored, because strength decays with time
     and a number written last week is not true today. */
  const units = await db
    .select({
      strength: memorizationUnits.strength,
      ease: memorizationUnits.ease,
      reps: memorizationUnits.reps,
      lapses: memorizationUnits.lapses,
      intervalDays: memorizationUnits.intervalDays,
      lastReviewedAt: memorizationUnits.lastReviewedAt,
    })
    .from(memorizationUnits)
    .where(and(eq(memorizationUnits.userId, userId), eq(memorizationUnits.state, "memorized")));

  const now = Date.now();
  const fragile = units.filter((unit) => {
    const state: UnitState = {
      strength: unit.strength,
      ease: unit.ease,
      reps: unit.reps,
      lapses: unit.lapses,
      intervalDays: unit.intervalDays,
    };
    const days = unit.lastReviewedAt
      ? Math.max(0, Math.floor((now - unit.lastReviewedAt.getTime()) / 86_400_000))
      : 0;
    return decayedStrength(state, days) < FRAGILE_BELOW;
  }).length;

  /* And the covenant, if there is one. */
  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.userId, userId), eq(plans.status, "active")))
    .limit(1);

  let daysBanked: number | null = null;
  if (plan) {
    const studyDays = Math.max(
      1,
      countStudyDays(plan.startDate, plan.originalEndDate, plan.studyDaysMask),
    );
    daysBanked = computePace({
      totalLines: plan.totalLines,
      completedLines: plan.completedLines,
      originalDailyLines: Math.max(1, Math.ceil(plan.totalLines / studyDays)),
      today: todayIn(timeZone),
      endDate: plan.currentEndDate,
      studyDaysMask: plan.studyDaysMask,
    }).daysBanked;
  }

  return {
    memorized: counts?.memorized ?? 0,
    drills: counts?.drills ?? 0,
    held: counts?.held ?? 0,
    streak,
    fragile,
    daysBanked,
  };
}
