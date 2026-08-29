import type { Metadata } from "next";

import { requireRole } from "@/auth/guard";
import { surah as surahMeta } from "@/data/quran/loader";
import { AdminShell, Metric, Panel } from "@/components/admin/admin-shell";
import { DailyBars, Funnel, PaceBands, RankedBars } from "@/components/admin/charts";
import { Measure } from "@/components/ui/section";

import { loadAdmins, loadOverview } from "./data";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false, nocache: true },
};

/* English only, and not in the message files: these strings are for whoever
   runs Ahd, and translating an internal tool three ways buys nothing. */
const FUNNEL_LABELS: Record<string, string> = {
  signedUp: "Signed up",
  verified: "Verified their address",
  password: "Chose a password",
  onboarded: "Finished onboarding",
  planned: "Made a covenant",
  memorized: "Memorised a first page",
};

const BAND_LABELS: Record<string, string> = {
  done: "Finished",
  ahead: "Ahead of the promise",
  onTrack: "On track",
  tightening: "Tightening",
  atRisk: "At risk",
};

const TRACK_LABELS: Record<string, string> = {
  sabaq: "Sabaq — new",
  sabqi: "Sabqi — recent",
  manzil: "Manzil — old",
  test: "Practice drills",
};

const EVENT_LABELS: Record<string, string> = {
  signup: "signed up",
  login_success: "signed in",
  login_failure: "failed to sign in",
  logout: "signed out",
  logout_all: "signed out everywhere",
  email_verified: "verified their address",
  verification_resent: "asked for a new code",
  password_reset_requested: "asked to reset",
  password_reset_completed: "reset their password",
  password_changed: "changed their password",
  account_locked: "was locked out",
  account_deleted: "deleted their account",
};

/** "3 Sep, 14:20" — enough to place an event, without the noise of seconds. */
const WHEN = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminOverviewPage() {
  await requireRole("admin");

  const [overview, admins] = await Promise.all([loadOverview(), loadAdmins()]);
  const { totals, funnel, signups, bands, hardest, practice, events } = overview;

  /* The one number worth putting a judgement on: of everyone who ever signed
     up, how many actually hold a page of the Qur'an. */
  const reached = totals.users === 0 ? 0 : (funnel[funnel.length - 1].count / totals.users) * 100;

  return (
    <AdminShell current="overview">
      <Measure className="py-8 sm:py-10">
        <header>
          <h1 className="font-[family-name:var(--font-display)] text-[1.875rem] leading-tight font-light text-[var(--text-strong)]">
            Overview
          </h1>
          <p className="mt-2 text-[0.875rem] text-[var(--text-muted)]">
            {admins.length === 1
              ? "You are the only admin."
              : `${admins.length} accounts can see this page.`}
          </p>
        </header>

        {/* ── The figures ── */}
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            value={totals.users}
            label="Accounts"
            hint={totals.signupsThisWeek > 0 ? `+${totals.signupsThisWeek} this week` : "none this week"}
          />
          <Metric
            value={totals.activeThisWeek}
            label="Seen this week"
            hint="signed in within seven days"
            tone={totals.activeThisWeek > 0 ? "good" : "plain"}
          />
          <Metric value={totals.activePlans} label="Active covenants" />
          <Metric
            value={totals.pagesHeld}
            label="Pages held"
            hint="across everyone, of 604 each"
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric value={totals.verified} label="Verified addresses" />
          <Metric value={totals.onboarded} label="Finished onboarding" />
          <Metric value={totals.drills} label="Drills marked" />
          <Metric
            value={`${reached.toFixed(0)}%`}
            label="Reached a first page"
            hint="of everyone who signed up"
            tone={reached >= 40 ? "good" : "warn"}
          />
        </div>

        {/* ── The two that matter most ── */}
        <div className="mt-8 grid gap-4 lg:grid-cols-2 lg:items-start">
          <Panel
            title="Where people stop"
            note="all accounts, ever"
          >
            <Funnel stages={funnel} labels={FUNNEL_LABELS} />
            <p className="mt-5 border-t border-[var(--line-subtle)] pt-4 text-[0.75rem] leading-relaxed text-[var(--text-faint)]">
              Each percentage is of the step above it, not of the total. A stage
              under 60% is marked — that is where the product is losing people.
            </p>
          </Panel>

          <Panel title="Signups" note="last 30 days">
            <DailyBars
              data={signups}
              label="Signups per day over the last thirty days"
              emptyLabel="No signups in the last thirty days."
            />
          </Panel>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-start">
          <Panel title="How the covenants are holding" note="active plans">
            <PaceBands
              bands={bands}
              labels={BAND_LABELS}
              emptyLabel="No active covenants yet."
            />
          </Panel>

          <Panel title="Revision by track" note="every review ever logged">
            <RankedBars
              rows={practice.map((row) => ({
                key: row.type,
                label: TRACK_LABELS[row.type] ?? row.type,
                value: row.count,
                note: `avg ${row.averageQuality.toFixed(1)}/5`,
              }))}
              emptyLabel="Nothing has been revised yet."
            />
          </Panel>
        </div>

        {/* ── The report that is about the Qur'an rather than the software ── */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-start">
          <Panel title="Hardest passages" note="most missed, everyone">
            <RankedBars
              rows={hardest.map((row) => ({
                key: `${row.surah}:${row.ayah}`,
                label: `${surahMeta(row.surah).latin} ${row.surah}:${row.ayah}`,
                value: row.count,
              }))}
              emptyLabel="No mistakes recorded yet."
            />
            <p className="mt-5 border-t border-[var(--line-subtle)] pt-4 text-[0.75rem] leading-relaxed text-[var(--text-faint)]">
              Counted from drill mistakes across every account. Nothing else in
              Ahd can answer this, and it says something about the Qur&rsquo;an
              rather than about the software.
            </p>
          </Panel>

          <Panel title="Recent activity" note="last 12 events">
            {events.length === 0 ? (
              <p className="py-8 text-center text-[0.8125rem] text-[var(--text-faint)]">
                Nothing yet.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {events.map((event, i) => (
                  <li
                    key={`${event.createdAt.toISOString()}-${i}`}
                    className="flex items-baseline gap-3 text-[0.8125rem]"
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        event.kind.includes("failure") || event.kind.includes("locked")
                          ? "bg-[var(--status-critical)]"
                          : "bg-[var(--viz-3)]"
                      }`}
                    />
                    <span className="min-w-0 flex-1 truncate text-[var(--text-default)]">
                      <span className="text-[var(--text-muted)]">
                        {event.email ?? "someone"}
                      </span>{" "}
                      {EVENT_LABELS[event.kind] ?? event.kind}
                    </span>
                    <span className="shrink-0 text-[0.6875rem] text-[var(--text-faint)] tabular-nums">
                      {WHEN.format(event.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </Measure>
    </AdminShell>
  );
}
