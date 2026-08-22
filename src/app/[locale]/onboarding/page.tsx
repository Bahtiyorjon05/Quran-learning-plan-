import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requirePasswordUser } from "@/auth/guard";
import { AuthShell } from "@/components/auth/auth-shell";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { redirectTo } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function OnboardingPage() {
  /* requirePasswordUser, not requireOnboardedUser — guarding this page with the
     latter would bounce an un-onboarded person straight back to it, forever. */
  const user = await requirePasswordUser();
  if (user.onboardedAt) redirectTo("/app", user.locale);

  const t = await getTranslations("onboarding");

  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")}>
      <OnboardingForm />
    </AuthShell>
  );
}
