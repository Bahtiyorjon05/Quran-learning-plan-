import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { desc, eq } from "drizzle-orm";
import {
  BadgeCheck,
  Layers,
  LogOut,
  Monitor,
  RefreshCw,
  Smartphone,
  Sprout,
} from "lucide-react";

import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { requireOnboardedUser } from "@/auth/guard";
import { Wordmark } from "@/components/brand/logo";
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
      <header className="sticky top-0 z-40 border-b border-[var(--line-subtle)] bg-[color-mix(in_oklab,var(--surface-base)_88%,transparent)] backdrop-blur-xl">
        <Measure className="flex h-16 items-center justify-between gap-3 sm:h-18 sm:gap-4">
          <Link href="/app" aria-label="Ahd" className="shrink-0">
            <Wordmark priority size={32} />
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label={tn("logout")}
                className={buttonStyles({
                  variant: "outline",
                  size: "sm",
                  className: "max-sm:h-9 max-sm:w-9 max-sm:px-0",
                })}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="max-sm:hidden">{tn("logout")}</span>
              </button>
            </form>
          </div>
        </Measure>
      </header>

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
            {/* ── The covenant, not yet made ── */}
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
                  <span className="shrink-0 rounded-full border border-gold-500/30 bg-gold-500/10 px-2.5 py-1 text-[0.625rem] font-semibold tracking-[0.12em] text-gold-ink uppercase">
                    {ta("covenant.upcoming")}
                  </span>
                </div>

                <p className="mt-3 text-[0.9375rem] text-[var(--text-default)]">
                  {ta("covenant.empty")}
                </p>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--text-muted)]">
                  {ta("covenant.soon")}
                </p>

                {/* The three tracks, dimmed. This is the shape the page takes
                    once a plan exists, so the empty state teaches the layout
                    instead of just apologising for being empty. */}
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
