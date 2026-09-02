import "server-only";

import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  authEvents,
  memorizationUnits,
  mistakes,
  plans,
  profiles,
  planDays,
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

  /* ── This person's own numbers ──
     A list of accounts answers "who signed up". These answer the question
     actually asked when a name is looked up: is this person getting anywhere,
     and if not, where did they stop. */
  /** Mean strength across the pages they hold, 0–100. */
  averageStrength: number;
  /** Drills finished, ever. */
  drills: number;
  /** Unresolved weak spots. */
  openMistakes: number;
  /** Days on which every owed track was completed. */
  daysKept: number;
  /** What they chose at onboarding, for support questions. */
  locale: string | null;
  reciter: string | null;
  studyTime: string | null;
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

      /* Still one query. Correlated subqueries on indexed user_id columns cost
         far less than a round trip each, and the alternative — a query per row
         — is the classic reason an admin list takes nine seconds at scale. */
      averageStrength: sql<string | number | null>`(
        select round(avg(m.strength))::int from ${memorizationUnits} m
        where m.user_id = ${users.id} and m.state = 'memorized'
      )`,
      drills: sql<number>`(
        select count(*)::int from ${reviewLogs} r where r.user_id = ${users.id}
      )`,
      openMistakes: sql<number>`(
        select count(*)::int from ${mistakes} k
        where k.user_id = ${users.id} and k.resolved_at is null
      )`,
      daysKept: sql<number>`(
        select count(*)::int from ${planDays} d
        join ${plans} p on p.id = d.plan_id
        where p.user_id = ${users.id} and d.status = 'complete'
      )`,
      locale: profiles.locale,
      reciter: profiles.preferredReciter,
      studyTime: profiles.studyTime,
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
    averageStrength: row.averageStrength === null ? 0 : Number(row.averageStrength),
    drills: Number(row.drills),
    openMistakes: Number(row.openMistakes),
    daysKept: Number(row.daysKept),
    locale: row.locale ?? null,
    reciter: row.reciter ?? null,
    /* A `time` column arrives as "05:30:00"; the seconds are noise here. */
    studyTime: row.studyTime ? String(row.studyTime).slice(0, 5) : null,
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

/* ═══════════════════════════════════════════════════════════════════════════
   THE DEEPER REPORTS
   Everything above answers "how many". These answer "is it working" — whether
   people come back, what they chose, and when they actually study.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Cohort = {
  /** Monday of the week people signed up in. */
  week: string;
  joined: number;
  /** Of those, how many have been seen in the last fortnight. */
  retained: number;
};

export type Slice = { key: string; count: number };

export type HourCount = { hour: number; count: number };

export type Leader = {
  displayName: string | null;
  email: string;
  pagesHeld: number;
  strength: number;
};

export type AdminDepth = {
  activity: DayCount[];
  memorized: DayCount[];
  cohorts: Cohort[];
  locales: Slice[];
  reciters: Slice[];
  scopes: Slice[];
  studyHours: HourCount[];
  leaders: Leader[];
  streak: { current: number; longest: number } | null;
};

export async function loadDepth(): Promise<AdminDepth> {
  const [activity, memorized, cohorts, locales, reciters, scopes, hours, leaders, streaks] =
    await Promise.all([
      /* Drills marked per day. Dense, like the signup series: a missing day and
         a zero day look identical on a chart, and they are not the same thing. */
      db.execute(sql`
        select to_char(day, 'YYYY-MM-DD') as date, coalesce(n, 0)::int as count
        from generate_series(current_date - ${DAYS_IN_WINDOW - 1}::int, current_date,
                             interval '1 day') as day
        left join (
          select date_trunc('day', created_at) as d, count(*) as n
          from ${reviewLogs} group by 1
        ) c on c.d = day
        order by day
      `),

      db.execute(sql`
        select to_char(day, 'YYYY-MM-DD') as date, coalesce(n, 0)::int as count
        from generate_series(current_date - ${DAYS_IN_WINDOW - 1}::int, current_date,
                             interval '1 day') as day
        left join (
          select date_trunc('day', first_memorized_at) as d, count(*) as n
          from ${memorizationUnits}
          where state = 'memorized' and first_memorized_at is not null
          group by 1
        ) c on c.d = day
        order by day
      `),

      /* Retention by signup week. The only honest answer to "is this working":
         of the people who arrived in a given week, how many are still here. */
      db.execute(sql`
        select to_char(week, 'YYYY-MM-DD') as week,
               count(*)::int as joined,
               count(*) filter (
                 where exists (
                   select 1 from ${sessions} s
                   where s.user_id = u.id and s.last_seen_at > now() - interval '14 days'
                 )
               )::int as retained
        from (
          select id, date_trunc('week', created_at) as week from ${users}
        ) u
        where week > now() - interval '10 weeks'
        group by week
        order by week
      `),

      db
        .select({ key: profiles.locale, count: sql<number>`count(*)::int` })
        .from(profiles)
        .groupBy(profiles.locale)
        .orderBy(desc(sql`count(*)`)),

      db
        .select({ key: profiles.preferredReciter, count: sql<number>`count(*)::int` })
        .from(profiles)
        .groupBy(profiles.preferredReciter)
        .orderBy(desc(sql`count(*)`)),

      db
        .select({ key: plans.scope, count: sql<number>`count(*)::int` })
        .from(plans)
        .groupBy(plans.scope)
        .orderBy(desc(sql`count(*)`)),

      /* When people say they will study. Answers a real product question —
         whether the reminder should go out at Fajr or after Isha. */
      db.execute(sql`
        select extract(hour from study_time)::int as hour, count(*)::int as count
        from ${profiles}
        where study_time is not null
        group by 1 order by 1
      `),

      db
        .select({
          displayName: users.displayName,
          email: users.email,
          pagesHeld: sql<number>`count(${memorizationUnits.id})::int`,
          strength: sql<number>`coalesce(round(avg(${memorizationUnits.strength})), 0)::int`,
        })
        .from(memorizationUnits)
        .innerJoin(users, eq(users.id, memorizationUnits.userId))
        .where(eq(memorizationUnits.state, "memorized"))
        .groupBy(users.id, users.displayName, users.email)
        .orderBy(desc(sql`count(${memorizationUnits.id})`))
        .limit(8),

      db.execute(sql`
        select coalesce(max(current_streak), 0)::int as current,
               coalesce(max(longest_streak), 0)::int as longest
        from ${profiles}
      `),
    ]);

  const streakRow = (streaks.rows[0] ?? {}) as Record<string, number>;

  return {
    activity: activity.rows as unknown as DayCount[],
    memorized: memorized.rows as unknown as DayCount[],
    cohorts: cohorts.rows as unknown as Cohort[],
    locales,
    reciters,
    scopes,
    studyHours: hours.rows as unknown as HourCount[],
    leaders,
    streak:
      streakRow.longest > 0
        ? { current: streakRow.current ?? 0, longest: streakRow.longest ?? 0 }
        : null,
  };
}
