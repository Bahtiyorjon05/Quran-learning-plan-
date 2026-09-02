import type { Metadata } from "next";
import { BadgeCheck, ChevronLeft, ChevronRight, Search, ShieldCheck } from "lucide-react";

import { requireAdmin } from "@/auth/guard";
import { AdminShell, Panel } from "@/components/admin/admin-shell";
import { Measure } from "@/components/ui/section";
import { todayIn, type CivilDate } from "@/core/date/civil";
import { computePace, type Pace, type PaceBand } from "@/core/plan/pace";
import { countStudyDays } from "@/core/plan/schedule";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { ACTIVITY_DAYS, loadUsers, type AdminUser } from "../data";

export const metadata: Metadata = {
  title: "People · Admin",
  robots: { index: false, follow: false, nocache: true },
};

const PER_PAGE = 25;

const WHEN = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/** "3 days ago", or "never". Precise dates are noise in a scanned list. */
function ago(date: Date | null): string {
  if (!date) return "never";
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/**
 * How this person's promise is actually going.
 *
 * Progress alone cannot answer it: forty per cent is comfortable in year one
 * of three and desperate in the last month. The same model the reader's own
 * dashboard uses is run here, so the admin sees exactly what they see.
 */
function paceOf(person: AdminUser): { pace: Pace; elapsed: number } | null {
  const c = person.covenant;
  if (!c) return null;

  const today = todayIn(c.timeZone ?? "Asia/Tashkent");

  const pace = computePace({
    totalLines: c.totalLines,
    completedLines: c.completedLines,
    /* The portion agreed at signing, recovered from the original deadline, so
       pressure does not drift when the deadline is pulled closer. */
    originalDailyLines: Math.max(
      1,
      Math.ceil(
        c.totalLines /
          Math.max(1, countStudyDays(c.startDate, c.originalEndDate, c.studyDaysMask)),
      ),
    ),
    today,
    endDate: c.endDate,
    studyDaysMask: c.studyDaysMask,
  });

  /* Where the calendar has got to, which is what progress has to be read
     against. Measured in study days rather than dates, because somebody
     studying four days a week is not behind on the other three. */
  const totalDays = Math.max(1, countStudyDays(c.startDate, c.endDate, c.studyDaysMask));
  const goneDays = countStudyDays(c.startDate, today as CivilDate, c.studyDaysMask);
  const elapsed = Math.max(0, Math.min(1, goneDays / totalDays));

  return { pace, elapsed };
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdmin();

  const { q, page } = await searchParams;
  const search = (q ?? "").slice(0, 120);
  const requested = Number.parseInt(page ?? "1", 10);

  const { people, total, page: current, pageCount } = await loadUsers(
    search,
    Number.isFinite(requested) ? requested : 1,
    PER_PAGE,
  );

  const from = total === 0 ? 0 : (current - 1) * PER_PAGE + 1;
  const to = (current - 1) * PER_PAGE + people.length;

  return (
    <AdminShell current="users">
      <Measure className="py-8 sm:py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-display)] text-[1.875rem] leading-tight font-light text-[var(--text-strong)]">
              People
            </h1>
            <p className="mt-2 text-[0.875rem] text-[var(--text-muted)]">
              {total === 0
                ? search
                  ? `Nobody matches “${search}”`
                  : "No accounts yet"
                : `${from}–${to} of ${total}${search ? ` matching “${search}”` : ""}`}
            </p>
          </div>

          {/* A plain GET form: no JavaScript, bookmarkable, and it survives a
              reload — everything a search box on an internal tool needs. */}
          <form className="relative w-full sm:w-auto" role="search">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Search by email…"
              aria-label="Search accounts by email"
              className="h-10 w-full rounded-full border border-[var(--line-strong)] bg-[var(--surface-raised)]/50 ps-10 pe-4 text-sm text-[var(--text-strong)] transition-colors duration-300 focus:border-[var(--accent)] focus:outline-none sm:w-72"
            />
          </form>
        </header>

        <div className="mt-7">
          {people.length === 0 ? (
            <Panel title="Accounts">
              <p className="py-10 text-center text-[0.8125rem] text-[var(--text-faint)]">
                Nobody matches that.
              </p>
            </Panel>
          ) : (
            <ul className="space-y-3">
              {people.map((person) => (
                <li key={person.id}>
                  <PersonPanel person={person} />
                </li>
              ))}
            </ul>
          )}

          <Pagination current={current} pageCount={pageCount} search={search} />

          <p className="mt-6 text-[0.75rem] leading-relaxed text-[var(--text-faint)]">
            These are real people&rsquo;s addresses and real progress. The list
            exists to answer support questions and to see whether the product is
            working — not to be browsed. Nothing here can be edited from this
            screen, and roles are changed from the command line on purpose.
          </p>
        </div>
      </Measure>
    </AdminShell>
  );
}

/**
 * One person, as a panel rather than a table row.
 *
 * A row of nine columns was unreadable on a phone and, worse, had nowhere to
 * put the two things that actually answer "how is this person doing" — the
 * covenant against the calendar, and whether they are still turning up. Both
 * are pictures, and pictures do not fit in a cell.
 */
function PersonPanel({ person }: { person: AdminUser }) {
  const state = paceOf(person);

  return (
    <div className="min-w-0 rounded-2xl border border-[var(--line-subtle)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Identity person={person} />
        {state && <BandChip band={state.pace.band} />}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-7">
        <div className="min-w-0">
          <CovenantTrack person={person} state={state} />

          <dl className="mt-5 grid grid-cols-3 gap-x-3 gap-y-3.5 sm:grid-cols-6">
            <Figure label="Pages" value={person.pagesHeld || "—"} />
            <Figure
              label="Strength"
              value={person.pagesHeld ? `${person.averageStrength}%` : "—"}
            />
            <Figure label="Drills" value={person.drills || "—"} />
            <Figure label="Days kept" value={person.daysKept || "—"} />
            <Figure
              label="Weak spots"
              value={person.openMistakes || "—"}
              tone={person.openMistakes > 0 ? "warn" : "plain"}
            />
            <Figure label="Last seen" value={ago(person.lastSeenAt)} />
          </dl>
        </div>

        <ActivityStrip counts={person.activity} />
      </div>

      <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[var(--line-subtle)] pt-3 text-[0.6875rem] text-[var(--text-faint)]">
        <span>Joined {WHEN.format(person.createdAt)}</span>
        {person.locale && <span>· {person.locale.toUpperCase()}</span>}
        {person.reciter && <span>· {person.reciter}</span>}
        {person.studyTime && <span>· studies {person.studyTime}</span>}
        {!person.onboarded && <span>· never finished onboarding</span>}
      </p>
    </div>
  );
}

/** Name, badges and address. */
function Identity({ person }: { person: AdminUser }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="flex items-center gap-1.5">
        <span className="truncate font-medium text-[var(--text-strong)]">
          {person.displayName || "—"}
        </span>
        {person.role === "admin" && (
          <ShieldCheck
            className="h-3.5 w-3.5 shrink-0 text-[var(--status-warning-ink)]"
            aria-label="Admin"
          />
        )}
        {person.verified && (
          <BadgeCheck
            className="h-3.5 w-3.5 shrink-0 text-[var(--status-good-ink)]"
            aria-label="Verified"
          />
        )}
      </span>
      <span className="mt-0.5 truncate text-[0.75rem] text-[var(--text-muted)]">
        {person.email}
      </span>
    </span>
  );
}

/* Status, never colour alone: every one of these ships its word. */
const BAND_LABEL: Record<PaceBand, string> = {
  done: "Finished",
  ahead: "Ahead",
  onTrack: "On track",
  tightening: "Tightening",
  atRisk: "At risk",
};

const BAND_CHIP: Record<PaceBand, string> = {
  done: "border-[var(--accent)]/40 bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-[var(--accent-strong)]",
  ahead:
    "border-[var(--accent)]/40 bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-[var(--accent-strong)]",
  onTrack: "border-[var(--line-strong)] text-[var(--text-muted)]",
  tightening:
    "border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10 text-[var(--status-warning-ink)]",
  atRisk:
    "border-[var(--status-critical)]/40 bg-[var(--status-critical)]/10 text-[var(--status-critical-ink)]",
};

const BAND_FILL: Record<PaceBand, string> = {
  done: "bg-[var(--accent)]",
  ahead: "bg-[var(--accent)]",
  onTrack: "bg-[var(--accent)]",
  tightening: "bg-[var(--status-warning)]",
  atRisk: "bg-[var(--status-critical)]",
};

function BandChip({ band }: { band: PaceBand }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-1 text-[0.625rem] font-semibold tracking-[0.1em] uppercase",
        BAND_CHIP[band],
      )}
    >
      {BAND_LABEL[band]}
    </span>
  );
}

/**
 * The promise against the calendar.
 *
 * One track carrying two quantities: how much of the Qur'an is done (the fill)
 * and how much of the time is gone (the marker). Where the marker sits ahead
 * of the fill, this person is behind — and the gap between them is the whole
 * story, told without a number needing to be read.
 */
function CovenantTrack({
  person,
  state,
}: {
  person: AdminUser;
  state: { pace: Pace; elapsed: number } | null;
}) {
  if (!state || !person.covenant) {
    return (
      <p className="text-[0.8125rem] text-[var(--text-faint)]">
        {person.onboarded ? "No covenant made yet." : "Never finished onboarding."}
      </p>
    );
  }

  const { pace, elapsed } = state;
  const progress = Math.max(0, Math.min(1, pace.progress));
  const behind = elapsed - progress;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[0.75rem] text-[var(--text-muted)]">
          Finish by{" "}
          <span className="text-[var(--text-default)]">
            {WHEN.format(new Date(`${person.covenant.endDate}T00:00:00Z`))}
          </span>
        </span>
        <span className="text-[0.75rem] tabular-nums text-[var(--text-muted)]">
          <span className="font-medium text-[var(--text-strong)]">
            {Math.round(progress * 100)}%
          </span>{" "}
          done · {Math.round(elapsed * 100)}% of the time gone
        </span>
      </div>

      <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--text-strong)_9%,transparent)]">
        <div
          className={cn("h-full rounded-full", BAND_FILL[pace.band])}
          style={{ width: `${Math.max(1, progress * 100)}%` }}
        />
        {/* Where the calendar has reached. The 2px surface-coloured ring keeps
            it legible wherever it lands, including on top of the fill. */}
        <span
          aria-hidden
          className="absolute top-0 h-full w-0.5 bg-[var(--text-strong)] ring-2 ring-[var(--surface-raised)]"
          style={{ insetInlineStart: `calc(${elapsed * 100}% - 1px)` }}
        />
      </div>

      <p className="mt-2 text-[0.75rem] text-[var(--text-muted)]">
        {pace.complete
          ? "The whole promise is kept."
          : behind > 0.02
            ? `${Math.round(behind * 100)} points behind the calendar · ${pace.requiredDailyLines} lines a day to finish on time`
            : `${pace.requiredDailyLines} lines a day to finish on time · ${
                pace.daysBanked >= 0
                  ? `${pace.daysBanked} days banked`
                  : `${Math.abs(pace.daysBanked)} days owed`
              }`}
      </p>
    </div>
  );
}

/**
 * Whether they are still turning up.
 *
 * Twenty-eight columns, one per day, height by drills finished. A total says
 * how much someone has ever done; this says whether they are doing it now,
 * which is the difference between a healthy account and one that has quietly
 * stopped. One hue, because this is a magnitude and nothing else.
 */
function ActivityStrip({ counts }: { counts: number[] }) {
  const peak = Math.max(1, ...counts);
  const done = counts.reduce((sum, n) => sum + n, 0);
  const activeDays = counts.filter((n) => n > 0).length;

  const first = new Date();
  first.setUTCDate(first.getUTCDate() - (ACTIVITY_DAYS - 1));

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.625rem] font-semibold tracking-[0.1em] text-[var(--text-faint)] uppercase">
          Drills, last {ACTIVITY_DAYS} days
        </span>
        <span className="text-[0.75rem] tabular-nums text-[var(--text-muted)]">
          {done === 0 ? (
            <span className="text-[var(--text-faint)]">nothing</span>
          ) : (
            <>
              <span className="font-medium text-[var(--text-strong)]">{done}</span> on{" "}
              {activeDays} {activeDays === 1 ? "day" : "days"}
            </>
          )}
        </span>
      </div>

      {/* A 2px gap between columns, and 4px rounded tops anchored to the
          baseline, so a day with one drill is still visibly a day with one. */}
      <div className="mt-2.5 flex h-14 items-end gap-[2px]" role="img"
           aria-label={`${done} drills over the last ${ACTIVITY_DAYS} days`}>
        {counts.map((n, i) => (
          <span
            key={i}
            title={n > 0 ? `${n}` : undefined}
            className={cn(
              "min-w-0 flex-1 rounded-t-[3px]",
              n > 0 ? "bg-[var(--viz-3)]" : "bg-[color-mix(in_oklab,var(--text-strong)_7%,transparent)]",
            )}
            style={{ height: n > 0 ? `${Math.max(12, (n / peak) * 100)}%` : "3px" }}
          />
        ))}
      </div>

      <div className="mt-1.5 flex justify-between text-[0.625rem] text-[var(--text-faint)] tabular-nums">
        <span>{DAY.format(first)}</span>
        <span>today</span>
      </div>
    </div>
  );
}

/** One figure in the summary row. */
function Figure({
  label,
  value,
  tone = "plain",
}: {
  label: string;
  value: string | number;
  tone?: "plain" | "warn";
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.625rem] tracking-[0.08em] text-[var(--text-faint)] uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 truncate text-[0.9375rem] font-medium tabular-nums",
          tone === "warn"
            ? "text-[var(--status-warning-ink)]"
            : "text-[var(--text-strong)]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Plain links, not buttons.
 *
 * Every page of this list is a real address: it can be bookmarked, opened in a
 * new tab, and reached with JavaScript off. The search term travels with it,
 * or paging through a filtered list would silently drop the filter.
 */
function Pagination({
  current,
  pageCount,
  search,
}: {
  current: number;
  pageCount: number;
  search: string;
}) {
  if (pageCount <= 1) return null;

  const href = (page: number) =>
    `/admin/users?${new URLSearchParams({
      ...(search ? { q: search } : {}),
      ...(page > 1 ? { page: String(page) } : {}),
    })}`;

  const step =
    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[0.8125rem] transition-colors duration-300";

  return (
    <nav
      className="mt-5 flex items-center justify-between gap-3"
      aria-label="Pages of accounts"
    >
      {current > 1 ? (
        <Link href={href(current - 1)} rel="prev" className={cn(step, "border-[var(--line-strong)] text-[var(--text-default)] hover:border-[var(--accent)]/50")}>
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          Newer
        </Link>
      ) : (
        <span className={cn(step, "border-transparent text-[var(--text-faint)]")}>
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          Newer
        </span>
      )}

      <span className="text-[0.75rem] text-[var(--text-muted)] tabular-nums">
        Page {current} of {pageCount}
      </span>

      {current < pageCount ? (
        <Link href={href(current + 1)} rel="next" className={cn(step, "border-[var(--line-strong)] text-[var(--text-default)] hover:border-[var(--accent)]/50")}>
          Older
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
      ) : (
        <span className={cn(step, "border-transparent text-[var(--text-faint)]")}>
          Older
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </span>
      )}
    </nav>
  );
}
