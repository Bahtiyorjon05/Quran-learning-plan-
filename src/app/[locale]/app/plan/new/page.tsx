import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db/client";
import { plans, profiles } from "@/db/schema";
import { requireOnboardedUser } from "@/auth/guard";
import { todayIn } from "@/core/date/civil";
import { CovenantWizard } from "@/components/plan/covenant-wizard";
import { Wordmark } from "@/components/brand/logo";
import { Measure } from "@/components/ui/section";
import { Link, redirectTo } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("plan.new");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function NewCovenantPage() {
  const user = await requireOnboardedUser();

  /* One live covenant at a time. Someone who already has one belongs on the
     dashboard, not on a form that would be refused at the end. */
  const [existing] = await db
    .select({ id: plans.id })
    .from(plans)
    .where(and(eq(plans.userId, user.id), eq(plans.status, "active")))
    .limit(1);
  if (existing) redirectTo("/app", user.locale);

  /* The start date is the student's own today. Deciding it here rather than in
     the browser keeps the preview and the covenant that gets written in
     agreement, even if a device clock is wrong. */
  const [profile] = await db
    .select({ timeZone: profiles.timeZone })
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-[var(--line-subtle)]">
        <Measure className="flex h-16 items-center sm:h-18">
          <Link href="/app" aria-label="Ahd">
            <Wordmark size={32} />
          </Link>
        </Measure>
      </header>

      <Measure className="py-10 sm:py-14">
        <CovenantWizard today={todayIn(profile?.timeZone ?? "Asia/Tashkent")} />
      </Measure>
    </div>
  );
}
