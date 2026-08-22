import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { desc, eq } from "drizzle-orm";
import { LogOut, MonitorSmartphone, ShieldCheck } from "lucide-react";

import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { requireUser } from "@/auth/guard";
import { Wordmark } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { buttonStyles } from "@/components/ui/button";
import { Measure, Panel } from "@/components/ui/section";
import { Link } from "@/i18n/navigation";
import { logoutAction, logoutEverywhereAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("dashboard"), robots: { index: false, follow: false } };
}

/**
 * Placeholder dashboard.
 *
 * Phase 1 replaces this with the real daily sheet — sabaq, sabqi and manzil.
 * For now it exists to prove the whole authenticated path end to end, and to
 * give the session controls somewhere to live.
 */
export default async function AppHomePage() {
  const user = await requireUser();
  const tn = await getTranslations("nav");
  const tp = await getTranslations("landing.preview");

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

  return (
    <div className="min-h-dvh">
      <header className="border-b border-[var(--line-subtle)]">
        <Measure className="flex h-16 items-center justify-between gap-4 sm:h-18">
          <Link href="/app" aria-label="Ahd">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <form action={logoutAction}>
              <button
                type="submit"
                className={buttonStyles({ variant: "outline", size: "sm" })}
              >
                <LogOut className="h-3.5 w-3.5" />
                {tn("logout")}
              </button>
            </form>
          </div>
        </Measure>
      </header>

      <Measure className="py-12 sm:py-16">
        <p className="flex items-center gap-2 text-sm text-emerald-400">
          <ShieldCheck className="h-4 w-4" />
          {user.email}
        </p>

        <h1 className="mt-4 font-[family-name:var(--font-display)] text-[2.5rem] leading-tight font-light text-[var(--text-strong)]">
          {tp("today")}
        </h1>

        <p className="mt-4 max-w-xl leading-relaxed text-[var(--text-muted)]">
          Phase 1 puts the covenant wizard and the three daily tracks here.
        </p>

        <Panel className="mt-10 max-w-2xl">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
            <MonitorSmartphone className="h-4 w-4 text-[var(--accent)]" />
            Active sessions
          </h2>

          <ul className="mt-4 divide-y divide-[var(--line-subtle)]">
            {active.map((session) => (
              <li key={session.id} className="flex items-baseline gap-3 py-3 text-sm">
                <span
                  className={
                    session.id === user.sessionId
                      ? "h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
                      : "h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-faint)]"
                  }
                />
                <span className="min-w-0 flex-1 truncate text-[var(--text-muted)]">
                  {session.userAgent ?? "unknown device"}
                </span>
                <span className="shrink-0 text-xs text-[var(--text-faint)] tabular-nums">
                  {session.ip ?? "—"}
                </span>
              </li>
            ))}
          </ul>

          <form action={logoutEverywhereAction} className="mt-5">
            <button
              type="submit"
              className={buttonStyles({ variant: "ghost", size: "sm" })}
            >
              Sign out everywhere
            </button>
          </form>
        </Panel>
      </Measure>
    </div>
  );
}
