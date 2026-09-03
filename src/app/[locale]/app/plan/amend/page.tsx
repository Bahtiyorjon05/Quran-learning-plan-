import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, Lock } from "lucide-react";

import { db } from "@/db/client";
import { plans, profiles } from "@/db/schema";
import { requireOnboardedUser } from "@/auth/guard";
import { addDays, todayIn } from "@/core/date/civil";
import { AppHeader } from "@/components/app/app-header";
import { Atmosphere } from "@/components/app/atmosphere";
import { AmendForm } from "@/components/plan/amend-form";
import { Measure } from "@/components/ui/section";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { timesShortened } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("amend");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function AmendPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireOnboardedUser();
  const t = await getTranslations("amend");

  const [plan] = await db
    .select({
      id: plans.id,
      startDate: plans.startDate,
      currentEndDate: plans.currentEndDate,
      totalLines: plans.totalLines,
      completedLines: plans.completedLines,
      studyDaysMask: plans.studyDaysMask,
    })
    .from(plans)
    .where(and(eq(plans.userId, user.id), eq(plans.status, "active")))
    .limit(1);

  const [profile] = await db
    .select({ timeZone: profiles.timeZone })
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);

  const dateFormat = new Intl.DateTimeFormat(
    locale === "uz" ? "uz-UZ" : locale === "ru" ? "ru-RU" : "en-US",
    { day: "numeric", month: "long", year: "numeric" },
  );

  const spent = plan ? (await timesShortened(plan.id)) >= 1 : false;
  const today = todayIn(profile?.timeZone ?? "Asia/Tashkent");

  return (
    <div className="relative min-h-dvh">
      <Atmosphere />
      <AppHeader />

      <main className="relative z-10">
        <Measure className="py-8 sm:py-12">
          <header className="animate-rise">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 text-[0.8125rem] text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]"
            >
              <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
              {t("back")}
            </Link>

            <h1 className="mt-4 font-[family-name:var(--font-display)] text-[2rem] leading-tight font-light text-[var(--text-strong)] sm:text-[2.5rem]">
              {t("title")}
            </h1>
            <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
              {t("subtitle")}
            </p>
          </header>

          <div className="animate-rise mx-auto mt-8 max-w-xl space-y-5 [animation-delay:80ms]">
            {!plan ? (
              <p className="panel rounded-3xl p-8 text-center text-[0.9375rem] text-[var(--text-muted)]">
                {t("noPlan")}
              </p>
            ) : (
              <>
                <div className="panel rounded-3xl p-5 sm:p-6">
                  <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-[var(--text-faint)] uppercase">
                    {t("current")}
                  </p>
                  <p className="mt-2 font-[family-name:var(--font-display)] text-[1.75rem] leading-tight font-light text-[var(--text-strong)]">
                    {dateFormat.format(new Date(`${plan.currentEndDate}T00:00:00Z`))}
                  </p>
                  <p className="mt-1 text-[0.8125rem] text-[var(--text-muted)]">
                    {t("startedOn")}{" "}
                    {dateFormat.format(new Date(`${plan.startDate}T00:00:00Z`))}
                  </p>
                </div>

                {spent ? (
                  /* Fixed, and said as a fact rather than as a refusal — the
                     limit was agreed to at signing, not imposed now. */
                  <div className="panel rounded-3xl p-6 text-center sm:p-8">
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-gold-500/35 bg-gold-500/10">
                      <Lock className="h-5 w-5 text-gold-ink" strokeWidth={1.8} />
                    </span>
                    <p className="mt-4 text-[1.0625rem] font-medium text-[var(--text-strong)]">
                      {t("spentTitle")}
                    </p>
                    <p className="mx-auto mt-2 max-w-sm text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
                      {t("spentBody")}
                    </p>
                    <Link href="/app" className={buttonStyles({ variant: "outline", className: "mt-6" })}>
                      {t("back")}
                    </Link>
                  </div>
                ) : (
                  <AmendForm
                    currentEndDate={plan.currentEndDate}
                    earliest={addDays(today, 1)}
                    remainingLines={Math.max(0, plan.totalLines - plan.completedLines)}
                    currentDailyLines={Math.max(
                      1,
                      Math.ceil(
                        Math.max(0, plan.totalLines - plan.completedLines) /
                          Math.max(
                            1,
                            Math.round(
                              (new Date(`${plan.currentEndDate}T00:00:00Z`).getTime() -
                                new Date(`${today}T00:00:00Z`).getTime()) /
                                86_400_000,
                            ),
                          ),
                      ),
                    )}
                    studyDaysMask={plan.studyDaysMask}
                  />
                )}
              </>
            )}
          </div>
        </Measure>
      </main>
    </div>
  );
}
