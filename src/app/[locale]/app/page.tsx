import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { and, desc, eq } from "drizzle-orm";
import {
  ArrowRight,
  BookOpen,
  Target,
  ChevronDown,
  Flame,
  Monitor,
  Smartphone,
} from "lucide-react";

import { db } from "@/db/client";
import { plans, profiles, sessions } from "@/db/schema";
import { todayIn } from "@/core/date/civil";
import { computePace } from "@/core/plan/pace";
import { countStudyDays as countStudyDaysBetween } from "@/core/plan/schedule";
import { requireOnboardedUser } from "@/auth/guard";
import { AppHeader } from "@/components/app/app-header";
import { Atmosphere } from "@/components/app/atmosphere";
import { Corners } from "@/components/ui/ornament";
import { buttonStyles } from "@/components/ui/button";
import { Measure } from "@/components/ui/section";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { logoutEverywhereAction } from "./actions";
import { loadToday } from "./today";
import { InstallApp } from "@/components/site/install-app";
import { loadSummary } from "./mistakes/data";
import { practicablePages } from "./practice/session";
import type { QuranLocale } from "@/data/quran/loader";
import { CovenantArc, Stat } from "@/components/app/covenant-arc";
import { PracticeInvite } from "@/components/app/practice-invite";
import { MushafMosaic } from "@/components/app/mushaf-mosaic";
import { TOTAL_PAGES } from "@/core/quran/mushaf";
import { DailySheet, type TrackView } from "@/components/app/daily-sheet";
import { describeLineRange } from "@/core/quran/mushaf";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("dashboard"), robots: { index: false, follow: false } };
}

/** A phone or a computer, guessed from the user agent for the sessions list. */
function isPhone(userAgent: string | null) {
  return /android|iphone|ipad|mobile/i.test(userAgent ?? "");
}

/**
 * "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36…" tells a
 * person nothing. Show the two parts they can actually recognise as their own
 * device: the browser and the platform.
 */
function describeDevice(userAgent: string | null, fallback: string) {
  if (!userAgent) return fallback;

  const browser = /edg/i.test(userAgent)
    ? "Edge"
    : /opr|opera/i.test(userAgent)
      ? "Opera"
      : /chrome|crios/i.test(userAgent)
        ? "Chrome"
        : /firefox|fxios/i.test(userAgent)
          ? "Firefox"
          : /safari/i.test(userAgent)
            ? "Safari"
            : null;

  const platform = /windows/i.test(userAgent)
    ? "Windows"
    : /android/i.test(userAgent)
      ? "Android"
      : /iphone|ipad|ios/i.test(userAgent)
        ? "iOS"
        : /mac os/i.test(userAgent)
          ? "macOS"
          : /linux/i.test(userAgent)
            ? "Linux"
            : null;

  if (browser && platform) return `${browser} · ${platform}`;
  return browser ?? platform ?? fallback;
}

/**
 * Turns today's sheet into what the three cards need.
 *
 * A track with nothing owed is still shown, dimmed, rather than hidden: seeing
 * that revision is empty because nothing has been memorized yet teaches the
 * shape of the day better than an absence would.
 */
function buildTracks(
  today: NonNullable<Awaited<ReturnType<typeof loadToday>>>,
  ta: Awaited<ReturnType<typeof getTranslations>>,
): TrackView[] {
  const { sheet, done } = today;

  let sabaqDetail: string | null = null;
  let sabaqPages: number[] = [];
  if (sheet.sabaq) {
    const span = describeLineRange(sheet.sabaq.fromLine, sheet.sabaq.toLine);
    sabaqPages = [span.fromPage];
    sabaqDetail = span.singlePage
      ? ta("today.sabaqRange", {
          page: span.fromPage,
          from: span.fromLineOnPage,
          to: span.toLineOnPage,
        })
      : ta("today.sabaqSpan", {
          fromPage: span.fromPage,
          toPage: span.toPage,
          lines: span.lines,
        });
  }

  /* A handful of pages read better as their own numbers; a juz-sized list reads
     better as a count. */
  const listDetail = (pages: number[]) =>
    pages.length === 0
      ? null
      : pages.length <= 5
        ? pages.join(", ")
        : `${pages[0]}–${pages[pages.length - 1]} · ${ta("today.pageList", { count: pages.length })}`;

  return [
    {
      id: "sabaq",
      arabic: "سبق",
      detail: sabaqDetail,
      pages: sabaqPages,
      done: done.sabaq,
      empty: !sheet.sabaq,
    },
    {
      id: "sabqi",
      arabic: "سبقي",
      detail: listDetail(sheet.sabqi),
      pages: sheet.sabqi,
      done: done.sabqi,
      empty: sheet.sabqi.length === 0,
    },
    {
      id: "manzil",
      arabic: "منزل",
      detail: listDetail(sheet.manzil),
      pages: sheet.manzil,
      done: done.manzil,
      empty: sheet.manzil.length === 0,
    },
  ];
}

export default async function AppHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireOnboardedUser();
  const ta = await getTranslations("app");
  const tw = await getTranslations("mistakes");
  const tp = await getTranslations("app.pace");

  const [covenant] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.userId, user.id), eq(plans.status, "active")))
    .limit(1);

  const [profile] = await db
    .select({ timeZone: profiles.timeZone })
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);

  const today = todayIn(profile?.timeZone ?? "Asia/Tashkent");

  const pace = covenant
    ? computePace({
        totalLines: covenant.totalLines,
        completedLines: covenant.completedLines,
        /* The portion agreed at signing, recovered from the original deadline —
           it is what pressure is measured against, and it must not drift when
           the deadline is later pulled closer. */
        originalDailyLines: Math.max(
          1,
          Math.ceil(
            covenant.totalLines /
              Math.max(1, countStudyDaysBetween(covenant.startDate, covenant.originalEndDate, covenant.studyDaysMask)),
          ),
        ),
        today,
        endDate: covenant.currentEndDate,
        studyDaysMask: covenant.studyDaysMask,
      })
    : null;

  const sheet = await loadToday(user.id);

  /* The mosaic and the practice invitation both come from what is held, so
     the pages are fetched once and shaped twice. */
  const [pages, weakSpots, active] = await Promise.all([
    practicablePages(user.id, locale as QuranLocale),
    loadSummary(user.id),
    db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      ip: sessions.ip,
      lastSeenAt: sessions.lastSeenAt,
    })
    .from(sessions)
    .where(eq(sessions.userId, user.id))
    .orderBy(desc(sessions.lastSeenAt))
    .limit(10),
  ]);

  const strengths = new Array<number>(TOTAL_PAGES).fill(0);
  for (const item of pages) strengths[item.page - 1] = item.strength;

  const held = pages.length;
  const averageStrength = held
    ? Math.round(pages.reduce((sum, p) => sum + p.strength, 0) / held)
    : 0;
  const fragile = pages.filter((p) => p.fragile).length;

  const dateFormat = new Intl.DateTimeFormat(
    user.locale === "uz" ? "uz-UZ" : user.locale === "ru" ? "ru-RU" : "en-US",
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
  );


  return (
    <div className="relative min-h-dvh">
      <Atmosphere />
      <AppHeader />

      <main className="relative z-10">
        <Measure className="py-8 sm:py-12">
          {/* Greeting. The email used to sit here: it is a fact about the
              account, not about today, and a screen opened every morning should
              not spend its best line on it. */}
          <div className="animate-rise flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="font-arabic flex items-center gap-3 text-lg text-gold-ink/80" dir="rtl" aria-hidden>
                السلام عليكم
                <span className="h-px w-10 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--gold)_45%,transparent),transparent)] rtl:bg-[linear-gradient(270deg,color-mix(in_oklab,var(--gold)_45%,transparent),transparent)]" />
              </p>
              <h1 className="mt-1.5 font-[family-name:var(--font-display)] text-[2rem] leading-tight font-light text-[var(--text-strong)] sm:text-[2.75rem]">
                {user.displayName || ta("welcome")}
              </h1>
            </div>

            {sheet && sheet.streak > 0 && (
              <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-3.5 py-1.5 text-[0.8125rem] font-medium text-gold-ink">
                <Flame className="h-4 w-4" />
                {ta("today.streak", { count: sheet.streak })}
              </span>
            )}
          </div>

          {/* The covenant, given the whole width. It is the promise everything
              else exists to keep, and it was sharing a row with a list of
              logged-in devices. */}
          <section className="animate-rise sheen panel relative mt-8 overflow-hidden rounded-3xl [animation-delay:80ms]">
            <div aria-hidden className="girih pointer-events-none absolute inset-0 opacity-[0.035]" />
            <Corners />
            {/* A wash of the accent in the top corner, so the panel is lit from
                the same direction as the ground behind it. */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-32 -left-24 h-64 w-64 rounded-full opacity-40 blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, color-mix(in oklab, var(--accent) 22%, transparent), transparent 68%)",
              }}
            />

            {!covenant || !pace ? (
              <div className="relative px-6 py-12 text-center sm:px-8">
                <h2 className="font-[family-name:var(--font-display)] text-2xl font-normal text-[var(--text-strong)]">
                  {ta("covenant.title")}
                </h2>
                <p className="mx-auto mt-3 max-w-md text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
                  {ta("covenant.soon")}
                </p>
                <Link
                  href="/app/plan/new"
                  className={buttonStyles({ size: "lg", className: "group mt-7" })}
                >
                  {ta("covenant.start")}
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180" />
                </Link>
              </div>
            ) : (
              <div className="relative p-6 sm:p-8">
                <div className="flex flex-col items-center gap-8 sm:flex-row sm:gap-10">
                  <CovenantArc
                    pace={pace}
                    label={`${
                      pace.progress > 0 && pace.progress < 0.01
                        ? (pace.progress * 100).toFixed(1)
                        : Math.round(pace.progress * 100)
                    }%`}
                    caption={tp("memorised")}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-[family-name:var(--font-display)] text-2xl font-normal text-[var(--text-strong)]">
                        {ta("covenant.title")}
                      </h2>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2.5 py-1 text-[0.625rem] font-semibold tracking-[0.12em] uppercase",
                          pace.band === "ahead" || pace.band === "done"
                            ? "border-[var(--accent)]/35 bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-[var(--accent-strong)]"
                            : pace.band === "onTrack"
                              ? "border-[var(--line-strong)] text-[var(--text-muted)]"
                              : pace.band === "tightening"
                                ? "border-gold-500/35 bg-gold-500/10 text-gold-ink"
                                : "border-clay-500/40 bg-clay-500/10 text-danger",
                        )}
                      >
                        {tp(pace.band)}
                      </span>
                    </div>

                    <p className="mt-2 text-[0.9375rem] text-[var(--text-muted)]">
                      {tp("finishBy")}{" "}
                      <span className="font-medium text-[var(--text-strong)]">
                        {dateFormat.format(new Date(`${covenant.currentEndDate}T00:00:00Z`))}
                      </span>
                    </p>

                    <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
                      <Stat
                        value={String(pace.requiredDailyLines)}
                        label={tp("statDaily")}
                        tone={pace.pressure > 1.15 ? "warn" : "plain"}
                      />
                      <Stat value={String(held)} label={tp("statHeld")} />
                      <Stat value={String(pace.remainingStudyDays)} label={tp("statDays")} />
                      <Stat
                        value={pace.daysBanked >= 0 ? `+${pace.daysBanked}` : String(pace.daysBanked)}
                        label={pace.daysBanked >= 0 ? tp("statBanked") : tp("statOwed")}
                        tone={pace.daysBanked >= 0 ? "good" : "warn"}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-8 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--text-strong)_8%,transparent)]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-emerald-600),var(--accent))] transition-[width] duration-1000 ease-[var(--ease-calm)]"
                    style={{ width: `${Math.max(0.5, pace.progress * 100)}%` }}
                  />
                </div>

                {covenant.niyyah && (
                  <p className="mt-6 border-t border-[var(--line-subtle)] pt-5 text-center text-[0.875rem] leading-relaxed text-[var(--text-muted)] italic">
                    &ldquo;{covenant.niyyah}&rdquo;
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Today, and what to drill. */}
          {covenant && sheet && (
            <div className="animate-rise mt-6 grid gap-5 [animation-delay:140ms] lg:grid-cols-[1.4fr_1fr] lg:items-start">
              <section className="panel rounded-3xl p-6 sm:p-7">
                <DailySheet
                  tracks={buildTracks(sheet, ta)}
                  /* The streak is already in the greeting; showing it twice on
                     one screen makes it look like two different numbers. */
                  streak={0}
                  complete={
                    (sheet.sheet.sabaq === null || sheet.done.sabaq) &&
                    (sheet.sheet.sabqi.length === 0 || sheet.done.sabqi) &&
                    (sheet.sheet.manzil.length === 0 || sheet.done.manzil)
                  }
                />
              </section>

              <div className="space-y-5">
                <PracticeInvite weakest={pages[0] ?? null} fragileCount={fragile} held={held} />

                {/* Only shown where it can actually be acted on: the component
                    draws nothing at all in a browser that cannot install. */}
                {weakSpots.ayahs > 0 && (
                  <Link
                    href="/app/mistakes"
                    className="group panel panel-interactive flex items-center gap-4 rounded-2xl p-5 sm:p-6"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-overlay)]">
                      <Target className="h-4.5 w-4.5 text-[var(--accent)]" strokeWidth={1.6} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] font-medium text-[var(--text-strong)]">
                        {tw("title")}
                      </span>
                      <span className="mt-1 block text-[0.8125rem] text-[var(--text-muted)]">
                        {tw("openCount", {
                          ayahs: weakSpots.ayahs,
                          times: weakSpots.open,
                        })}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-faint)] transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180" />
                  </Link>
                )}

                <InstallApp />

                {held > 0 && (
                  <Link
                    href="/app/quran"
                    className="group panel panel-interactive flex items-center gap-4 rounded-2xl p-5 sm:p-6"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-overlay)]">
                      <BookOpen className="h-4.5 w-4.5 text-[var(--accent)]" strokeWidth={1.6} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] font-medium text-[var(--text-strong)]">
                        {ta("mushaf.title")}
                      </span>
                      <span className="mt-1 block text-[0.8125rem] text-[var(--text-muted)]">
                        {ta("mushaf.heldSummary", { held, average: averageStrength })}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-faint)] transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180" />
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* The mushaf as a shape: 604 tiles is the one view that makes a
              three-year covenant feel finite. */}
          {held > 0 && (
            <div className="animate-rise [animation-delay:200ms]">
              <MushafMosaic
                strengths={strengths}
                held={held}
                averageStrength={averageStrength}
                basePath="/app/quran"
              />
            </div>
          )}

          {/* Devices, folded away. It matters when it matters, and never on the
              morning of an ordinary day. */}
          <details className="animate-rise panel group mt-10 rounded-2xl [animation-delay:260ms]">
            <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]">
              <Monitor className="h-4 w-4 shrink-0" strokeWidth={1.6} />
              <span className="flex-1">{ta("sessions.title")}</span>
              <span className="text-[0.75rem] text-[var(--text-faint)] tabular-nums">
                {active.length}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-300 group-open:rotate-180" />
            </summary>

            <div className="border-t border-[var(--line-subtle)] px-5 py-4">
              <ul className="space-y-1">
                {active.map((session) => {
                  const current = session.id === user.sessionId;
                  const DeviceIcon = isPhone(session.userAgent) ? Smartphone : Monitor;
                  return (
                    <li
                      key={session.id}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5",
                        current && "bg-[color-mix(in_oklab,var(--accent)_9%,transparent)]",
                      )}
                    >
                      <DeviceIcon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          current ? "text-[var(--accent)]" : "text-[var(--text-faint)]",
                        )}
                        strokeWidth={1.6}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-[var(--text-default)]">
                          {describeDevice(session.userAgent, ta("sessions.unknownDevice"))}
                        </span>
                        {current && (
                          <span className="text-[0.6875rem] text-[var(--accent)]">
                            {ta("sessions.thisDevice")}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-mono text-[0.6875rem] text-[var(--text-faint)] tabular-nums">
                        {session.ip ?? "\u2014"}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <form
                action={logoutEverywhereAction}
                className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line-subtle)] pt-5"
              >
                <p className="min-w-0 flex-1 text-xs leading-relaxed text-[var(--text-faint)]">
                  {ta("sessions.note")}
                </p>
                <button type="submit" className={buttonStyles({ variant: "outline", size: "sm" })}>
                  {ta("sessions.signOutEverywhere")}
                </button>
              </form>
            </div>
          </details>
        </Measure>
      </main>
    </div>
  );
}
