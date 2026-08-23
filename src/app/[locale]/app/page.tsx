import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { and, desc, eq } from "drizzle-orm";
import {
  ArrowRight,
  BadgeCheck,
  Layers,
  LogOut,
  Monitor,
  RefreshCw,
  Smartphone,
  Sprout,
} from "lucide-react";

import { db } from "@/db/client";
import { plans, profiles, sessions } from "@/db/schema";
import { todayIn } from "@/core/date/civil";
import { computePace } from "@/core/plan/pace";
import { countStudyDays as countStudyDaysBetween } from "@/core/plan/schedule";
import { requireOnboardedUser } from "@/auth/guard";
import { AppHeader } from "@/components/app/app-header";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { buttonStyles } from "@/components/ui/button";
import { Measure } from "@/components/ui/section";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { logoutAction, logoutEverywhereAction } from "./actions";

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

export default async function AppHomePage() {
  const user = await requireOnboardedUser();
  const ta = await getTranslations("app");
  const tn = await getTranslations("nav");
  const tt = await getTranslations("landing.tracks");
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

  const active = await db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      ip: sessions.ip,
      lastSeenAt: sessions.lastSeenAt,
    })
    .from(sessions)
    .where(eq(sessions.userId, user.id))
    .orderBy(desc(sessions.lastSeenAt))
    .limit(10);

  const tracks = [
    { ar: "سبق", name: tt("sabaq.name"), role: tt("roleNew"), Icon: Sprout },
    { ar: "سبقي", name: tt("sabqi.name"), role: tt("roleRecent"), Icon: RefreshCw },
    { ar: "منزل", name: tt("manzil.name"), role: tt("roleOld"), Icon: Layers },
  ];

  return (
    <div className="min-h-dvh">
      <AppHeader />

      <main>
        <Measure className="py-10 sm:py-14">
          {/* ── Greeting ── */}
          <div className="animate-rise">
            <p className="font-arabic text-lg text-gold-ink/80" dir="rtl" aria-hidden>
              السلام عليكم
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-[2.25rem] leading-tight font-light text-[var(--text-strong)] sm:text-[2.75rem]">
              {user.displayName || ta("welcome")}
            </h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <BadgeCheck className="h-4 w-4 shrink-0 text-[var(--accent)]" />
              <span className="truncate">{user.email}</span>
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:items-start">
            {/* ── The covenant ── */}
            <section className="animate-rise relative overflow-hidden rounded-2xl border border-[var(--line-strong)] bg-[linear-gradient(160deg,var(--surface-raised),var(--surface-base))] p-6 [animation-delay:80ms] sm:p-8">
              <div
                aria-hidden
                className="girih pointer-events-none absolute inset-0 opacity-[0.03]"
              />

              <div className="relative">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-[family-name:var(--font-display)] text-2xl font-normal text-[var(--text-strong)]">
                    {ta("covenant.title")}
                  </h2>
                  {pace && (
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
                  )}
                </div>

                {!covenant || !pace ? (
                  <>
                    <p className="mt-3 text-[0.9375rem] text-[var(--text-default)]">
                      {ta("covenant.empty")}
                    </p>
                    <p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--text-muted)]">
                      {ta("covenant.soon")}
                    </p>

                    <Link
                      href="/app/plan/new"
                      className={buttonStyles({ size: "lg", className: "group mt-7 w-full sm:w-auto" })}
                    >
                      {ta("covenant.start")}
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180" />
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="mt-4 text-xs text-[var(--text-muted)]">{tp("finishBy")}</p>
                    <p className="font-[family-name:var(--font-display)] text-[2rem] leading-none font-light text-[var(--text-strong)]">
                      {new Intl.DateTimeFormat(user.locale === "uz" ? "uz-UZ" : user.locale === "ru" ? "ru-RU" : "en-US", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        timeZone: "UTC",
                      }).format(new Date(`${covenant.currentEndDate}T00:00:00Z`))}
                    </p>

                    <div className="mt-6">
                      <div className="flex items-baseline justify-between text-xs text-[var(--text-muted)] tabular-nums">
                        <span>
                          {/* Below one per cent, rounding to a whole number
                              reports 0% to someone who has genuinely memorized
                              pages. One decimal until it stops mattering. */}
                          {tp("progress", {
                            percent:
                              pace.progress > 0 && pace.progress < 0.01
                                ? (pace.progress * 100).toFixed(1)
                                : Math.round(pace.progress * 100),
                          })}
                        </span>
                        <span>{tp("remaining", { lines: pace.remainingLines })}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--text-strong)_8%,transparent)]">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-emerald-600),var(--accent))] transition-[width] duration-700"
                          style={{ width: `${Math.max(1, Math.round(pace.progress * 100))}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex items-end justify-between gap-4 border-t border-[var(--line-subtle)] pt-5">
                      <p className="font-[family-name:var(--font-display)] text-xl font-light text-[var(--accent-strong)] tabular-nums">
                        {tp("requiredNow", { lines: pace.requiredDailyLines })}
                      </p>
                      <p className="shrink-0 text-xs text-[var(--text-faint)] tabular-nums">
                        {pace.daysBanked >= 0
                          ? tp("banked", { count: pace.daysBanked })
                          : tp("owed", { count: Math.abs(pace.daysBanked) })}
                      </p>
                    </div>

                    {covenant.niyyah && (
                      <p className="mt-6 border-t border-[var(--line-subtle)] pt-5 text-[0.875rem] leading-relaxed text-[var(--text-muted)] italic">
                        “{covenant.niyyah}”
                      </p>
                    )}
                  </>
                )}

                {/* The three tracks. Dimmed until the daily sheet is generated,
                    so the empty state teaches the layout it will take. */}
                <ul className="mt-7 space-y-2.5">
                  {tracks.map(({ ar, name, role, Icon }) => (
                    <li
                      key={name}
                      className="flex items-center gap-3.5 rounded-xl border border-dashed border-[var(--line-strong)] px-3.5 py-3 opacity-55"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-overlay)]">
                        <Icon
                          className="h-4 w-4 text-[var(--text-faint)]"
                          strokeWidth={1.6}
                        />
                      </span>
                      <span className="flex min-w-0 flex-1 items-baseline gap-2">
                        <span
                          className="font-arabic text-[0.9375rem] leading-none text-[var(--text-faint)]"
                          aria-hidden
                        >
                          {ar}
                        </span>
                        <span className="text-sm font-medium text-[var(--text-default)]">
                          {name}
                        </span>
                      </span>
                      <span className="shrink-0 text-[0.625rem] font-semibold tracking-[0.14em] text-[var(--text-faint)] uppercase">
                        {role}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* ── Sessions ── */}
            <section className="animate-rise rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-raised)]/60 p-6 [animation-delay:160ms] sm:p-7">
              <h2 className="text-sm font-semibold text-[var(--text-strong)]">
                {ta("sessions.title")}
              </h2>

              <ul className="mt-4 space-y-1">
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
                        {session.ip ?? "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <form
                action={logoutEverywhereAction}
                className="mt-5 border-t border-[var(--line-subtle)] pt-5"
              >
                <button
                  type="submit"
                  className={buttonStyles({
                    variant: "outline",
                    size: "sm",
                    className: "w-full",
                  })}
                >
                  {ta("sessions.signOutEverywhere")}
                </button>
                <p className="mt-3 text-xs leading-relaxed text-[var(--text-faint)]">
                  {ta("sessions.note")}
                </p>
              </form>
            </section>
          </div>
        </Measure>
      </main>
    </div>
  );
}
