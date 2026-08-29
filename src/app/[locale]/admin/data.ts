import "server-only";

import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  authEvents,
  memorizationUnits,
  mistakes,
  plans,
  profiles,
  reviewLogs,
  sessions,
  users,
} from "@/db/schema";
import { todayIn } from "@/core/date/civil";
import { computePace, type PaceBand } from "@/core/plan/pace";
import { countStudyDays } from "@/core/plan/schedule";

/**
 * Everything the admin screens read, in one place.
 *
 * All of it is aggregate SQL. The alternative — pulling rows into Node and
 * counting them there — would work today with two accounts and stop working
 * quietly at ten thousand, which is exactly the kind of thing that is never
 * noticed until it matters.
 *
 * The queries are issued together rather than in sequence: they do not depend
 * on each other, and a dashboard that makes fifteen round trips to Frankfurt
 * one after another takes a second to load for no reason.
 */

const DAYS_IN_WINDOW = 30;

export type Totals = {
  users: number;
  verified: number;
  onboarded: number;
  activePlans: number;
  pagesHeld: number;
  drills: number;
  activeThisWeek: number;
  signupsThisWeek: number;
};

/**
 * Where people stop.
 *
 * The single most useful thing an admin screen can show: six gates between
 * arriving and actually memorising something, and the count that clears each.
 * A number on its own says nothing; a number next to the one before it says
 * where the product is losing people.
 */
export type FunnelStage = {
  id: string;
  count: number;
  /** Share of the stage before it, 0–1. Null for the first. */
  conversion: number | null;
};

export type DayCount = { date: string; count: number };

export type BandCount = { band: PaceBand; count: number };

export type RankedAyah = { surah: number; ayah: number; count: number };

export type ModeCount = { type: string; count: number; averageQuality: number };

export type RecentEvent = {
  kind: string;
  email: string | null;
  createdAt: Date;
  detail: string | null;
};

export type AdminOverview = {
  totals: Totals;
  funnel: FunnelStage[];
  signups: DayCount[];
  bands: BandCount[];
  hardest: RankedAyah[];
  practice: ModeCount[];
  events: RecentEvent[];
};

export async function loadOverview(): Promise<AdminOverview> {
  const [counts, signups, planRows, hardest, practice, events] = await Promise.all([
    /* One row, one pass over the small tables. Counting these separately was
       six round trips for six integers. */
    db.execute(sql`
      select
        (select count(*) from ${users})::int as users,
        (select count(*) from ${users} where email_verified_at is not null)::int as verified,
        (select count(*) from ${users} where password_hash is not null)::int as with_password,
        (select count(*) from ${profiles} where onboarded_at is not null)::int as onboarded,
        (select count(*) from ${plans} where status = 'active')::int as active_plans,
        (select count(distinct user_id) from ${plans})::int as ever_planned,
        (select count(*) from ${memorizationUnits} where state = 'memorized')::int as pages_held,
        (select count(distinct user_id) from ${memorizationUnits} where state = 'memorized')::int as ever_memorized,
        (select count(*) from ${reviewLogs})::int as drills,
        (select count(distinct user_id) from ${sessions}
           where last_seen_at > now() - interval '7 days')::int as active_week,
        (select count(*) from ${users} where created_at > now() - interval '7 days')::int as signups_week
    `),

    /* A dense series: days with no signups have to appear as zero, or the
       shape of the chart lies about the gaps. generate_series supplies them. */
    db.execute(sql`
      select to_char(day, 'YYYY-MM-DD') as date, coalesce(n, 0)::int as count
      from generate_series(
             current_date - ${DAYS_IN_WINDOW - 1}::int,
             current_date,
             interval '1 day'
           ) as day
      left join (
        select date_trunc('day', created_at) as d, count(*) as n
        from ${users}
        group by 1
      ) counts on counts.d = day
      order by day
    `),

    db
      .select({
        id: plans.id,
        totalLines: plans.totalLines,
        completedLines: plans.completedLines,
        startDate: plans.startDate,
        originalEndDate: plans.originalEndDate,
        currentEndDate: plans.currentEndDate,
        studyDaysMask: plans.studyDaysMask,
        timeZone: profiles.timeZone,
      })
      .from(plans)
      .leftJoin(profiles, eq(profiles.userId, plans.userId))
      .where(eq(plans.status, "active")),

    /* Which passages the whole readership gets wrong. Nothing else in the
       product can answer this, and it is the one report that says something
       about the Qur'an rather than about the software. */
    db
      .select({
        surah: mistakes.surah,
        ayah: mistakes.ayah,
        count: sql<number>`count(*)::int`,
      })
      .from(mistakes)
      .groupBy(mistakes.surah, mistakes.ayah)
      .orderBy(desc(sql`count(*)`))
      .limit(10),

    db
      .select({
        type: reviewLogs.type,
        count: sql<number>`count(*)::int`,
        averageQuality: sql<number>`coalesce(round(avg(${reviewLogs.quality}), 2), 0)::float`,
      })
      .from(reviewLogs)
      .groupBy(reviewLogs.type)
      .orderBy(desc(sql`count(*)`)),

    db
      .select({
        kind: authEvents.kind,
        email: authEvents.email,
        createdAt: authEvents.createdAt,
        detail: authEvents.detail,
      })
      .from(authEvents)
      .orderBy(desc(authEvents.createdAt))
      .limit(12),
  ]);

  const row = (counts.rows[0] ?? {}) as Record<string, number>;

  const totals: Totals = {
    users: row.users ?? 0,
    verified: row.verified ?? 0,
    onboarded: row.onboarded ?? 0,
    activePlans: row.active_plans ?? 0,
    pagesHeld: row.pages_held ?? 0,
    drills: row.drills ?? 0,
    activeThisWeek: row.active_week ?? 0,
    signupsThisWeek: row.signups_week ?? 0,
  };

  const stages: { id: string; count: number }[] = [
    { id: "signedUp", count: row.users ?? 0 },
    { id: "verified", count: row.verified ?? 0 },
    { id: "password", count: row.with_password ?? 0 },
    { id: "onboarded", count: row.onboarded ?? 0 },
    { id: "planned", count: row.ever_planned ?? 0 },
    { id: "memorized", count: row.ever_memorized ?? 0 },
  ];

  const funnel: FunnelStage[] = stages.map((stage, i) => {
    const previous = i === 0 ? null : stages[i - 1].count;
    return {
      ...stage,
      conversion: previous === null ? null : previous === 0 ? 0 : stage.count / previous,
    };
  });

  /* Pace is a pure function of the plan and today's date, so it is computed
     here rather than stored — the same code the reader's own dashboard uses,
     which is why the two can never disagree. */
  const tally = new Map<PaceBand, number>();
  for (const plan of planRows) {
    const today = todayIn(plan.timeZone ?? "Asia/Tashkent");
    const studyDays = Math.max(
      1,
      countStudyDays(plan.startDate, plan.originalEndDate, plan.studyDaysMask),
    );
    const pace = computePace({
      totalLines: plan.totalLines,
      completedLines: plan.completedLines,
      originalDailyLines: Math.max(1, Math.ceil(plan.totalLines / studyDays)),
      today,
      endDate: plan.currentEndDate,
      studyDaysMask: plan.studyDaysMask,
    });
    tally.set(pace.band, (tally.get(pace.band) ?? 0) + 1);
  }

  const bands: BandCount[] = (
    ["done", "ahead", "onTrack", "tightening", "atRisk"] as PaceBand[]
  ).map((band) => ({ band, count: tally.get(band) ?? 0 }));

  return {
    totals,
    funnel,
    signups: signups.rows as unknown as DayCount[],
    bands,
    hardest,
    practice,
    events: events as RecentEvent[],
  };
}

export type AdminUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: "user" | "teacher" | "admin";
  verified: boolean;
  onboarded: boolean;
  createdAt: Date;
  lastSeenAt: Date | null;
  pagesHeld: number;
  planProgress: number | null;
};

/**
 * The people, newest first.
 *
 * Deliberately one query with joins rather than a list plus a count per row:
 * the per-row version is invisible at two users and is the classic reason an
 * admin page takes nine seconds at two thousand.
 */
export async function loadUsers(search: string, limit = 50): Promise<AdminUser[]> {
  const term = search.trim().toLowerCase();

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      verifiedAt: users.emailVerifiedAt,
      onboardedAt: profiles.onboardedAt,
      createdAt: users.createdAt,
      /* Typed as the driver actually returns it.
         `sql<Date>` would be an assertion, not a parse: Drizzle only converts
         columns it knows from the schema, and a raw subquery comes back as a
         string. Claiming Date here compiled cleanly and threw
         "getTime is not a function" in production. */
      lastSeenAt: sql<string | null>`(
        select max(s.last_seen_at) from ${sessions} s where s.user_id = ${users.id}
      )`,
      pagesHeld: sql<number>`(
        select count(*)::int from ${memorizationUnits} m
        where m.user_id = ${users.id} and m.state = 'memorized'
      )`,
      planProgress: sql<string | number | null>`(
        select case when p.total_lines > 0
                    then round(p.completed_lines::numeric / p.total_lines, 4)::float
               end
        from ${plans} p
        where p.user_id = ${users.id} and p.status = 'active'
        limit 1
      )`,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(term.length > 0 ? sql`lower(${users.email}) like ${`%${term}%`}` : undefined)
    .orderBy(desc(users.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    verified: row.verifiedAt !== null,
    onboarded: row.onboardedAt !== null,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt ? new Date(row.lastSeenAt) : null,
    pagesHeld: Number(row.pagesHeld),
    planProgress: row.planProgress === null ? null : Number(row.planProgress),
  }));
}

/** How many accounts exist, for the users page header. */
export async function countUsers(): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  return row?.n ?? 0;
}

/** Admins, so the page can say who else can see all of this. */
export async function loadAdmins(): Promise<{ email: string }[]> {
  return db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.role, "admin"), isNotNull(users.emailVerifiedAt)));
}
