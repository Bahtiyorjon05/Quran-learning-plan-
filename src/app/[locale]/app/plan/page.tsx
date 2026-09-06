import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { ArrowRight, CalendarDays, PenLine, Scroll } from "lucide-react";

import { db } from "@/db/client";
import { plans } from "@/db/schema";
import { requireOnboardedUser } from "@/auth/guard";
import { AppHeader } from "@/components/app/app-header";
import { Atmosphere } from "@/components/app/atmosphere";
import { Illuminated, Khatim, StarRule } from "@/components/ui/illumination";
import { Motes } from "@/components/ui/motes";
import { Measure } from "@/components/ui/section";
import { buttonStyles } from "@/components/ui/button";
import { LINES_PER_PAGE } from "@/core/quran/mushaf";
import { countStudyDays } from "@/core/plan/schedule";
import { Link, redirectTo } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("plan.covenant");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The seven days, as a mask, read back into names. */
const DAY_BITS = [1, 2, 4, 8, 16, 32, 64];

/**
 * The covenant, written out.
 *
 * Everywhere else in the app the ahd appears as a number — a percentage, a
 * count of days, a bar. That is what a dashboard is for. But the thing itself
 * is a promise somebody made in words, on a date, for a reason, and until now
 * there was nowhere to simply *read* it back.
 *
 * So this is a document rather than a screen: held to a page width, framed the
 * way a page is framed, and saying the terms in sentences instead of figures.
 * It is where the wizard leaves you, and where the dashboard and settings both
 * point when you want to see what you actually agreed to.
 */
export default async function CovenantPage() {
  const user = await requireOnboardedUser();
  const t = await getTranslations("plan.covenant");
  const tp = await getTranslations("plan");

  const [covenant] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.userId, user.id), eq(plans.status, "active")))
    .limit(1);

  if (!covenant) redirectTo("/app/plan/new", user.locale);

  const dateOf = new Intl.DateTimeFormat(
    user.locale === "uz" ? "uz-UZ" : user.locale === "ru" ? "ru-RU" : "en-US",
    /* Plain calendar dates, parsed as midnight Z: read back in UTC or they
       slide a day for anyone west of the meridian. */
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
  );
  const asDate = (value: string) => dateOf.format(new Date(`${value}T00:00:00Z`));

  const studyDays = countStudyDays(covenant.startDate, covenant.originalEndDate, covenant.studyDaysMask);
  const daily = Math.max(1, Math.ceil(covenant.totalLines / Math.max(1, studyDays)));
  const pages = Math.round(covenant.totalLines / LINES_PER_PAGE);
  const shortened = covenant.currentEndDate !== covenant.originalEndDate;

  const dayNames = (tp.raw("days") as string[]) ?? [];
  const chosenDays = DAY_BITS.map((bit, i) => (covenant.studyDaysMask & bit ? dayNames[i] : null))
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="relative min-h-dvh">
      <Atmosphere />
      <AppHeader />

      <main className="relative z-10 py-10 sm:py-16">
        <Measure>
          <div className="mx-auto max-w-2xl">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 text-[0.8125rem] text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]"
            >
              <ArrowRight className="h-4 w-4 rotate-180 rtl:rotate-0" />
              {t("back")}
            </Link>

            {/* The document. Framed like a page because that is what it is. */}
            <article className="panel animate-rise relative mt-5 overflow-hidden rounded-[2rem] p-7 text-center sm:p-12">
              <Illuminated inset="0.875rem" />
              <Motes />

              <div className="relative">
                <Khatim className="mx-auto h-9 w-9 text-[var(--gold)]" />

                <p className="mt-5 text-[0.75rem] font-semibold tracking-[0.24em] text-[var(--text-faint)] uppercase">
                  {t("eyebrow")}
                </p>
                <h1 className="mt-2 font-[family-name:var(--font-display)] text-[2rem] leading-tight font-light text-[var(--text-strong)] sm:text-[2.75rem]">
                  {t("title")}
                </h1>

                <StarRule className="mx-auto mt-7 max-w-xs" />

                {/* The promise, in one sentence, the way it would be said out
                    loud rather than as four figures in a row. */}
                <p className="mx-auto mt-7 max-w-md text-[1.0625rem] leading-[1.8] text-[var(--text-default)]">
                  {t.rich("sentence", {
                    scope: () => (
                      <strong className="font-medium text-[var(--text-strong)]">
                        {tp(`scopes.${covenant.scope}`, { from: covenant.scopeFromPage, to: covenant.scopeToPage })}
                      </strong>
                    ),
                    pages: () => (
                      <strong className="font-medium text-[var(--text-strong)]">{pages}</strong>
                    ),
                    daily: () => (
                      <strong className="font-medium text-[var(--accent-strong)]">{daily}</strong>
                    ),
                    end: () => (
                      <strong className="font-medium text-[var(--gold-ink)]">
                        {asDate(covenant.currentEndDate)}
                      </strong>
                    ),
                  })}
                </p>

                {covenant.niyyah && (
                  <>
                    <StarRule className="mx-auto mt-8 max-w-xs" />
                    <p className="mt-7 text-[0.6875rem] font-semibold tracking-[0.2em] text-[var(--text-faint)] uppercase">
                      {t("niyyah")}
                    </p>
                    <blockquote className="mx-auto mt-3 max-w-md font-[family-name:var(--font-display)] text-[1.25rem] leading-[1.7] text-[var(--text-strong)] italic sm:text-[1.5rem]">
                      &ldquo;{covenant.niyyah}&rdquo;
                    </blockquote>
                  </>
                )}

                {/* The terms, plainly. */}
                <dl className="mt-10 grid gap-x-8 gap-y-5 text-start sm:grid-cols-2">
                  <Term label={t("started")} value={asDate(covenant.startDate)} />
                  <Term
                    label={shortened ? t("deadlineNow") : t("deadline")}
                    value={asDate(covenant.currentEndDate)}
                    tone="gold"
                  />
                  <Term label={t("days")} value={chosenDays || t("everyDay")} />
                  <Term label={t("rate")} value={t("rateValue", { lines: daily })} />
                  {shortened && (
                    <Term
                      label={t("deadlineWas")}
                      value={asDate(covenant.originalEndDate)}
                      hint={t("shortenedNote")}
                    />
                  )}
                </dl>

                <p className="mx-auto mt-9 max-w-md border-t border-[var(--line-subtle)] pt-6 text-[0.8125rem] leading-relaxed text-[var(--text-faint)]">
                  {t("rule")}
                </p>

                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Link href="/app" className={buttonStyles({ size: "lg" })}>
                    <CalendarDays className="h-4 w-4" />
                    {t("toToday")}
                  </Link>
                  {!shortened && (
                    <Link
                      href="/app/plan/amend"
                      className={buttonStyles({ variant: "outline", size: "lg" })}
                    >
                      <PenLine className="h-4 w-4" />
                      {t("amend")}
                    </Link>
                  )}
                </div>
              </div>
            </article>

            <p className="mt-6 flex items-center justify-center gap-2 text-center text-[0.75rem] text-[var(--text-faint)]">
              <Scroll className="h-3.5 w-3.5 shrink-0" />
              {t("keep")}
            </p>
          </div>
        </Measure>
      </main>
    </div>
  );
}

function Term({
  label,
  value,
  hint,
  tone = "plain",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "plain" | "gold";
}) {
  return (
    <div className="border-t border-[var(--line-subtle)] pt-3">
      <dt className="text-[0.6875rem] tracking-[0.14em] text-[var(--text-faint)] uppercase">
        {label}
      </dt>
      <dd
        className={
          tone === "gold"
            ? "mt-1 text-[0.9375rem] font-medium text-[var(--gold-ink)]"
            : "mt-1 text-[0.9375rem] text-[var(--text-strong)]"
        }
      >
        {value}
      </dd>
      {hint && <p className="mt-1 text-[0.75rem] text-[var(--text-faint)]">{hint}</p>}
    </div>
  );
}
