import type { Metadata } from "next";
import { BadgeCheck, Search, ShieldCheck } from "lucide-react";

import { requireAdmin } from "@/auth/guard";
import { AdminShell, Panel } from "@/components/admin/admin-shell";
import { Measure } from "@/components/ui/section";
import { cn } from "@/lib/utils";

import { countUsers, loadUsers, type AdminUser } from "../data";

export const metadata: Metadata = {
  title: "People · Admin",
  robots: { index: false, follow: false, nocache: true },
};

const WHEN = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

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

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();

  const { q } = await searchParams;
  const search = (q ?? "").slice(0, 120);

  const [people, total] = await Promise.all([loadUsers(search), countUsers()]);

  return (
    <AdminShell current="users">
      <Measure className="py-8 sm:py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-display)] text-[1.875rem] leading-tight font-light text-[var(--text-strong)]">
              People
            </h1>
            <p className="mt-2 text-[0.875rem] text-[var(--text-muted)]">
              {search
                ? `${people.length} matching “${search}” of ${total}`
                : `${total} ${total === 1 ? "account" : "accounts"}, newest first`}
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
          <Panel title="Accounts" note={search ? "filtered" : "50 most recent"}>
            {people.length === 0 ? (
              <p className="py-10 text-center text-[0.8125rem] text-[var(--text-faint)]">
                Nobody matches that.
              </p>
            ) : (
              <>
                {/* ── Phones: a card each ──
                    Nine columns on a 390px screen is a sideways scroll nobody
                    discovers, and every number worth having ends up past the
                    right edge. Here each person is a block and their figures
                    sit under their name, where they can actually be read. */}
                <ul className="space-y-3 lg:hidden">
                  {people.map((person) => (
                    <li
                      key={person.id}
                      className="min-w-0 rounded-2xl border border-[var(--line-subtle)] p-4"
                    >
                      <Identity person={person} />

                      <dl className="mt-4 grid grid-cols-3 gap-x-3 gap-y-3.5">
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

                      <div className="mt-4 border-t border-[var(--line-subtle)] pt-3">
                        <Covenant person={person} />
                      </div>

                      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-[var(--text-faint)]">
                        <span>Joined {WHEN.format(person.createdAt)}</span>
                        {person.locale && <span>· {person.locale.toUpperCase()}</span>}
                        {person.reciter && <span>· {person.reciter}</span>}
                        {person.studyTime && <span>· studies {person.studyTime}</span>}
                      </p>
                    </li>
                  ))}
                </ul>

                {/* ── Laptops: the table ──
                    Genuinely tabular data, and a table keeps its headers
                    attached to its cells for a screen reader in a way a stack
                    of divs cannot. It scrolls inside its own box. */}
                <div className="-mx-5 hidden overflow-x-auto sm:-mx-6 lg:block">
                  <table className="w-full min-w-[64rem] border-collapse text-[0.8125rem]">
                    <thead>
                      <tr className="border-b border-[var(--line-subtle)] text-start">
                        {[
                          "Account",
                          "Joined",
                          "Last seen",
                          "Pages",
                          "Strength",
                          "Drills",
                          "Weak spots",
                          "Days kept",
                          "Covenant",
                        ].map((head, i) => (
                          <th
                            key={head}
                            scope="col"
                            className={cn(
                              "px-5 pb-3 text-[0.6875rem] font-semibold tracking-[0.1em] text-[var(--text-faint)] uppercase sm:px-6",
                              i === 0 ? "text-start" : "text-end",
                            )}
                          >
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {people.map((person) => (
                        <tr
                          key={person.id}
                          className="border-b border-[var(--line-subtle)] transition-colors duration-200 last:border-b-0 hover:bg-[var(--surface-overlay)]/40"
                        >
                          <td className="px-5 py-3.5 sm:px-6">
                            <Identity person={person} />
                          </td>

                          <td className="px-5 py-3.5 text-end text-[var(--text-muted)] tabular-nums sm:px-6">
                            {WHEN.format(person.createdAt)}
                          </td>

                          <td
                            className={cn(
                              "px-5 py-3.5 text-end tabular-nums sm:px-6",
                              person.lastSeenAt
                                ? "text-[var(--text-default)]"
                                : "text-[var(--text-faint)]",
                            )}
                          >
                            {ago(person.lastSeenAt)}
                          </td>

                          <Cell value={person.pagesHeld} strong />
                          <Cell value={person.pagesHeld ? `${person.averageStrength}%` : 0} />
                          <Cell value={person.drills} />
                          <Cell value={person.openMistakes} tone="warn" />
                          <Cell value={person.daysKept} />

                          <td className="px-5 py-3.5 text-end sm:px-6">
                            <Covenant person={person} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Panel>

          <p className="mt-5 text-[0.75rem] leading-relaxed text-[var(--text-faint)]">
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

/** Name, badges and address — the same block in the card and in the table. */
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

/** One figure in the phone card. */
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

/** One numeric cell in the table. Zero reads as nothing, not as a score. */
function Cell({
  value,
  strong = false,
  tone = "plain",
}: {
  value: string | number;
  strong?: boolean;
  tone?: "plain" | "warn";
}) {
  const empty = value === 0 || value === "0%";
  return (
    <td
      className={cn(
        "px-5 py-3.5 text-end tabular-nums sm:px-6",
        empty
          ? "text-[var(--text-faint)]"
          : tone === "warn"
            ? "text-[var(--status-warning-ink)]"
            : strong
              ? "font-medium text-[var(--text-strong)]"
              : "text-[var(--text-default)]",
      )}
    >
      {empty ? "—" : value}
    </td>
  );
}

/** How far into the promise they are, or why there is no bar to draw. */
function Covenant({ person }: { person: AdminUser }) {
  if (person.planProgress === null) {
    return (
      <span className="text-[0.75rem] text-[var(--text-faint)]">
        {person.onboarded ? "no covenant" : "not onboarded"}
      </span>
    );
  }

  return (
    <span className="inline-flex w-full items-center gap-2 lg:w-auto">
      <span className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--text-strong)_8%,transparent)] lg:w-16 lg:flex-none">
        <span
          className="block h-full rounded-full bg-[var(--viz-3)]"
          style={{ width: `${Math.max(2, person.planProgress * 100)}%` }}
        />
      </span>
      <span className="w-9 shrink-0 text-end text-[0.75rem] text-[var(--text-strong)] tabular-nums">
        {Math.round(person.planProgress * 100)}%
      </span>
    </span>
  );
}
