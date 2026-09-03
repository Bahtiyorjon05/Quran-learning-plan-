import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { and, eq } from "drizzle-orm";
import { ArrowRight, ScrollText } from "lucide-react";

import { db } from "@/db/client";
import { plans, profiles } from "@/db/schema";
import { requireOnboardedUser } from "@/auth/guard";
import { AppHeader } from "@/components/app/app-header";
import { Atmosphere } from "@/components/app/atmosphere";
import { SettingsForm } from "@/components/app/settings-form";
import { Measure } from "@/components/ui/section";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function SettingsPage() {
  const user = await requireOnboardedUser();
  const t = await getTranslations("settings");

  const [profile] = await db
    .select({
      studyTime: profiles.studyTime,
      reciter: profiles.preferredReciter,
      timeZone: profiles.timeZone,
      reminders: profiles.remindersEnabled,
      weekly: profiles.weeklyEmail,
    })
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);

  const [plan] = await db
    .select({ id: plans.id })
    .from(plans)
    .where(and(eq(plans.userId, user.id), eq(plans.status, "active")))
    .limit(1);

  return (
    <div className="relative min-h-dvh">
      <Atmosphere />
      <AppHeader />

      <main className="relative z-10">
        <Measure className="py-8 sm:py-12">
          <header className="animate-rise">
            <h1 className="font-[family-name:var(--font-display)] text-[2rem] leading-tight font-light text-[var(--text-strong)] sm:text-[2.5rem]">
              {t("title")}
            </h1>
            <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
              {t("subtitle")}
            </p>
          </header>

          <div className="animate-rise mx-auto mt-8 max-w-2xl [animation-delay:80ms]">
            <SettingsForm
              displayName={user.displayName ?? ""}
              email={user.email}
              /* A `time` column comes back as "05:30:00"; the input wants
                 "05:30" and the seconds were never meaningful. */
              studyTime={profile?.studyTime ? String(profile.studyTime).slice(0, 5) : ""}
              reciter={profile?.reciter ?? "alafasy"}
              timeZone={profile?.timeZone ?? "Asia/Tashkent"}
              reminders={profile?.reminders ?? true}
              weekly={profile?.weekly ?? true}
            />

            {/* The covenant is not a preference, so it is a door rather than a
                field: its own screen, with its own rules about what may change. */}
            {plan && (
              <Link
                href="/app/plan/amend"
                className="group panel panel-interactive mt-5 flex items-center gap-4 rounded-3xl p-5 sm:p-6"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold-500/30 bg-gold-500/10">
                  <ScrollText className="h-4.5 w-4.5 text-gold-ink" strokeWidth={1.6} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-medium text-[var(--text-strong)]">
                    {t("covenant")}
                  </span>
                  <span className="mt-1 block text-[0.8125rem] text-[var(--text-muted)]">
                    {t("covenantOpen")}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-faint)] transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180" />
              </Link>
            )}
          </div>
        </Measure>
      </main>
    </div>
  );
}
